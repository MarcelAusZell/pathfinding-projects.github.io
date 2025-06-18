import { useRef, useEffect, useState } from "react";

// Types and interfaces
interface DijkstraPathDrawerProps {
  rows: number;
  cols: number;
}

type CellStatus =
  | "blocked"
  | "passage"
  | "frontier"
  | "visited"
  | "source"
  | "target"
  | "shortestPath";

interface Cell {
  status: CellStatus;
}

interface Point {
  x: number;
  y: number;
}

interface QueueItem extends Point {
  dist: number;
}

function getVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

export default function DijkstraGridDrawer({
  cols,
  rows,
}: DijkstraPathDrawerProps) {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<Cell[][]>([]);
  const lastPosRef = useRef<Point | null>(null);

  // Algorithm state refs
  const distancesRef = useRef<number[][]>([]);
  const visitedRef = useRef<boolean[][]>([]);
  const predecessorsRef = useRef<Point[][]>([]);
  const dijkstraQueueRef = useRef<QueueItem[]>([]);
  const dijkstraChunkSizeRef = useRef(1);
  const dijkstraRunningRef = useRef(false);
  const shortestPathAnimatingRef = useRef(false);

  // UI state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<
    "blocked" | "passage" | "source" | "target"
  >("blocked");
  const [source, setSource] = useState<Point | null>(null);
  const [target, setTarget] = useState<Point | null>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [dijkstraChunkSize, setDijkstraChunkSize] = useState(1);
  const [dijkstraRunning, setDijkstraRunning] = useState(false);
  const [dijkstraPaused, setDijkstraPaused] = useState(false);
  const [pathFound, setPathFound] = useState(false);
  const [pathLength, setPathLength] = useState(0);

  /* ==== HELPER FUNCTIONS ==== */
  function isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < cols && y < rows;
  }

  function drawCell(x: number, y: number, status: CellStatus): void {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx == null) return;

    switch (status) {
      case "blocked":
        ctx.fillStyle = getVar("--color-base-200");
        break;
      case "passage":
        ctx.fillStyle = getVar("--color-base-100");
        break;
      case "frontier":
        ctx.fillStyle = getVar("--color-primary");
        break;
      case "visited":
        ctx.fillStyle = getVar("--color-primary");
        break;
      case "source":
        ctx.fillStyle = getVar("--color-error");
        break;
      case "target":
        ctx.fillStyle = getVar("--color-success");
        break;
      case "shortestPath":
        ctx.fillStyle = getVar("--color-secondary");
        break;
      default:
        ctx.fillStyle = "#000";
    }
    ctx.fillRect(x, y, 1, 1);
  }

  function getCanvasPosition(x: number, y: number): Point | undefined {
    const canvas = canvasRef.current;
    if (canvas == null) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = x - rect.left;
    const mouseY = y - rect.top;

    return {
      x: Math.floor(mouseX * scaleX),
      y: Math.floor(mouseY * scaleY),
    };
  }

  /* ==== CANVAS SETUP AND INITIALIZATION ==== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) return;

    // Setup canvas dimensions
    canvas.width = cols;
    canvas.height = rows;

    // Initialize grid
    const grid: Cell[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "passage" }))
    );
    cellsRef.current = grid;

    // Draw initial state
    grid.forEach((row, y) => row.forEach((_, x) => drawCell(x, y, "passage")));

    // Clear maze on initial setup
    clearMaze();

    // Observe theme changes to re-draw cells
    const observer = new MutationObserver(() => {
      cellsRef.current.forEach((row, y) =>
        row.forEach((cell, x) => drawCell(x, y, cell.status))
      );
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  /* ==== CANVAS EVENT HANDLERS ==== */
  function handlePointerDown(
    event: React.PointerEvent<HTMLCanvasElement>
  ): void {
    setIsDrawing(true);
    const point = getCanvasPosition(event.clientX, event.clientY);
    if (point == null) return;

    switch (drawingMode) {
      case "source":
        clearDijkstraResults();
        // Clear any existing source
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (cellsRef.current[y][x].status === "source") {
              cellsRef.current[y][x].status = "passage";
              drawCell(x, y, "passage");
            }
          }
        }
        // Set new source
        cellsRef.current[point.y][point.x].status = "source";
        drawCell(point.x, point.y, "source");
        setSource({ x: point.x, y: point.y });
        break;

      case "target":
        clearDijkstraResults();
        // Clear any existing target
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (cellsRef.current[y][x].status === "target") {
              cellsRef.current[y][x].status = "passage";
              drawCell(x, y, "passage");
            }
          }
        }
        // Set new target
        cellsRef.current[point.y][point.x].status = "target";
        drawCell(point.x, point.y, "target");
        setTarget({ x: point.x, y: point.y });
        break;

      case "blocked":
      case "passage":
        cellsRef.current[point.y][point.x].status = drawingMode;
        drawCell(point.x, point.y, drawingMode);
        lastPosRef.current = point;
        break;
    }
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>
  ): void {
    if (!isDrawing) return;

    const point = getCanvasPosition(event.clientX, event.clientY);
    const lastPoint = lastPosRef.current;

    if (
      point == null ||
      lastPoint == null ||
      drawingMode === "source" ||
      drawingMode === "target"
    ) {
      return;
    }

    // Bresenham's line algorithm for smooth drawing
    let x0 = lastPoint.x;
    let y0 = lastPoint.y;
    const x1 = point.x;
    const y1 = point.y;

    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;

    while (true) {
      if (isInBounds(x0, y0)) {
        cellsRef.current[y0][x0].status = drawingMode;
        drawCell(x0, y0, drawingMode);
      }

      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * error;
      if (e2 >= dy) {
        if (x0 === x1) break;
        error += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        if (y0 === y1) break;
        error += dx;
        y0 += sy;
      }
    }

    lastPosRef.current = point;
  }

  function handlePointerUp(_p0: unknown): void {
    setIsDrawing(false);
    lastPosRef.current = null;
  }

  function handlePointerLeave(_p0: unknown): void {
    setIsDrawing(false);
  }

  /* ==== DIJKSTRA ALGORITHM LOGIC ==== */
  function dijkstraInitialization(): void {
    if (visitedRef.current != null) {
      visitedRef.current.forEach((row, y) => {
        row.forEach((_, x) => {
          if (visitedRef.current != null) visitedRef.current[y][x] = false;
        });
      });
    }

    // Redraw the grid
    cellsRef.current.forEach((row, y) =>
      row.forEach((cell, x) => drawCell(x, y, cell.status))
    );

    // Early return if source or target is not set
    if (source == null || target == null) return;

    // Initialize algorithm structures
    const distances = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(Number.POSITIVE_INFINITY));

    const visited = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));

    const predecessors = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null));

    // Set source distance to zero
    distances[source.y][source.x] = 0;
    predecessors[source.y][source.x] = source;

    // Update refs
    visitedRef.current = visited;
    predecessorsRef.current = predecessors;
    distancesRef.current = distances;

    // Initialize queue with source node
    dijkstraQueueRef.current = [{ x: source.x, y: source.y, dist: 0 }];
  }
  function dijkstraOneStep(): void {
    if (source == null || target == null) return;

    const distances = distancesRef.current;
    const visited = visitedRef.current;
    const predecessors = predecessorsRef.current;
    const cells = cellsRef.current;
    const queue = dijkstraQueueRef.current;

    const { x: targetX, y: targetY } = target;

    // If target is already visited, animate the path
    if (target != null && visitedRef.current[target.y][target.x]) {
      animateShortestPath(source, target, predecessorsRef.current);
      return;
    }

    // Cardinal directions: left, right, up, down
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];

    // Process exactly one node when manually stepping
    // or a chunk of cells when auto-running based on the chunk size
    const maxSteps = dijkstraRunningRef.current
      ? dijkstraChunkSizeRef.current
      : 1;
    let count = 0;
    while (count++ < maxSteps && queue.length > 0) {
      // Sort queue by distance (simulating a min-heap)
      queue.sort((a, b) => a.dist - b.dist);

      // Get the node with smallest distance
      const current = queue.shift();
      if (current === undefined) break;

      const { x, y } = current;

      // Skip if already visited
      if (visited[y][x]) continue;

      // Mark as visited
      visited[y][x] = true;

      // Update visualization (except for source/target)
      if (cells[y][x].status !== "source" && cells[y][x].status !== "target") {
        cells[y][x].status = "visited";
        drawCell(x, y, "visited");
      }

      // Explore neighbors
      for (const { dx, dy } of directions) {
        const nx = x + dx;
        const ny = y + dy;

        // Check if neighbor is valid and not visited
        if (
          isInBounds(nx, ny) &&
          !visited[ny][nx] &&
          (cells[ny][nx].status === "passage" ||
            cells[ny][nx].status === "target")
        ) {
          const newDist = distances[y][x] + 1;

          // Update distances if we found a better path
          if (newDist < distances[ny][nx]) {
            distances[ny][nx] = newDist;
            predecessors[ny][nx] = { x, y };
            queue.push({ x: nx, y: ny, dist: newDist });
          }
        }
      }

      // Break early if we found the target
      if (visited[targetY][targetX]) break;
    }

    // If we found the target, animate the path
    if (visited[targetY][targetX]) {
      animateShortestPath(source, target, predecessorsRef.current);
    }
  }

  function animateShortestPath(
    source: Point,
    target: Point,
    predecessors: Point[][]
  ): void {
    const path: Point[] = [];
    let current: Point | null = target;

    while (current != null) {
      path.push(current);
      if (current.x === source.x && current.y === source.y) break;
      current = predecessors[current.y][current.x];
    }

    // Update path found status and length
    setPathFound(true);
    setPathLength(path.length - 2); // Subtract source and target nodes

    let i = 1;
    shortestPathAnimatingRef.current = true;
    function step(): void {
      if (!shortestPathAnimatingRef.current) return;
      if (i >= path.length - 1) {
        shortestPathAnimatingRef.current = false;
        return;
      }
      const { x, y } = path[i++];
      cellsRef.current[y][x].status = "shortestPath";
      drawCell(x, y, "shortestPath");

      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  /* ==== DIJKSTRA CONTROL FUNCTIONS ==== */
  function dijkstraPlay(): void {
    if (!dijkstraPaused) {
      clearDijkstraResults();
      dijkstraInitialization();
    }

    if (dijkstraRunningRef.current) return;

    dijkstraRunningRef.current = true;
    setDijkstraRunning(true);
    setDijkstraPaused(false);
    setDijkstraChunkSize((cols + rows) / 16);

    dijkstraStepLoop();
  }

  function dijkstraStop(): void {
    dijkstraRunningRef.current = false;
    setDijkstraRunning(false);
    setDijkstraPaused(true);
    setDijkstraChunkSize(1);
  }

  function dijkstraStepLoop(): void {
    if (!dijkstraRunningRef.current) return;

    dijkstraOneStep();

    // Check if finished (target visited)
    if (target != null && visitedRef.current[target.y][target.x]) {
      dijkstraRunningRef.current = false;
      setDijkstraRunning(false);
      return;
    }

    requestAnimationFrame(dijkstraStepLoop);
  }

  /* ==== GRID MANAGEMENT FUNCTIONS ==== */
  function clearMaze(): void {
    // Reset state
    setSource(null);
    setTarget(null);
    setDrawingMode("blocked");
    setIsDrawing(false);
    setPathFound(false);
    setPathLength(0);
    shortestPathAnimatingRef.current = false;
    cellsRef.current.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.status === "visited" || cell.status === "shortestPath") {
          cell.status = "passage";
          drawCell(x, y, "passage");
        }
      });
    });
    // Initialize blank grid
    const blankGrid: Cell[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "passage" }))
    );
    cellsRef.current = blankGrid;

    // Reset algorithm data structures
    distancesRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(Number.POSITIVE_INFINITY));

    visitedRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));

    predecessorsRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill({ x: -1, y: -1 }));

    // Redraw grid
    blankGrid.forEach((row, y) =>
      row.forEach((_, x) => drawCell(x, y, "passage"))
    );
  }

  function clearDijkstraResults(): void {
    // Reset algorithm state
    dijkstraRunningRef.current = false;
    setDijkstraRunning(false);
    setDijkstraPaused(false);
    shortestPathAnimatingRef.current = false;
    setPathFound(false);
    setPathLength(0);

    // Clear visualization
    cellsRef.current.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.status === "visited" || cell.status === "shortestPath") {
          cell.status = "passage";
          drawCell(x, y, "passage");
        }
      });
    });

    // Restore source and target
    if (source != null) {
      cellsRef.current[source.y][source.x].status = "source";
      drawCell(source.x, source.y, "source");
    }

    if (target != null) {
      cellsRef.current[target.y][target.x].status = "target";
      drawCell(target.x, target.y, "target");
    }

    // Reset algorithm data structures
    visitedRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    distancesRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(Number.POSITIVE_INFINITY));
    predecessorsRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null));

    // Re-initialize the algorithm after clearing
    if (source != null && target != null) {
      // Set source distance to zero
      if (source) {
        distancesRef.current[source.y][source.x] = 0;
      }

      // Re-initialize queue with source node
      dijkstraQueueRef.current = source
        ? [{ x: source.x, y: source.y, dist: 0 }]
        : [];
    } else {
      dijkstraQueueRef.current = [];
    }
  }

  /* ==== HTML OVERLAY POSITIONING ==== */
  function setHTMLOverlayToCanvas(point: Point, element: HTMLElement): void {
    const canvas = canvasRef.current;
    if (canvas == null) return;
    const container = canvas.parentElement;
    if (container == null) return;
    const canvasRect = canvas.getBoundingClientRect();
    const cellW = canvasRect.width / cols;
    const cellH = canvasRect.height / rows;
    const left = Math.round(point.x * cellW + cellW / 2);
    const top = Math.round(point.y * cellH);

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }

  /* ==== EFFECTS ==== */
  // Update chunk size ref when the state changes
  useEffect(() => {
    dijkstraChunkSizeRef.current = dijkstraChunkSize;
  }, [dijkstraChunkSize]);

  // Initialize Dijkstra when source or target changes
  useEffect(() => {
    if (source != null && target != null) {
      dijkstraInitialization();
    }
  }, [source, target]);

  // Handle window resizing
  useEffect(() => {
    function handleResize(): void {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Position source node tooltip
  useEffect(() => {
    if (source == null) return;

    const sourceElement = document.querySelector(".dijkstra-source-node");
    if (sourceElement instanceof HTMLElement) {
      setHTMLOverlayToCanvas(source, sourceElement);
    }
  }, [dimensions, source]);

  // Position target node tooltip
  useEffect(() => {
    if (target == null) return;

    const targetElement = document.querySelector(".dijkstra-target-node");
    if (targetElement instanceof HTMLElement) {
      setHTMLOverlayToCanvas(target, targetElement);
    }
  }, [dimensions, target]);

  return (
    <>
      <div>
        <div className="flex flex-col items-center">
          <div className="mb-2 flex w-full flex-col justify-center gap-2">
            {/* Algorithm control buttons */}
            <div className="join join-horizontal flex justify-center">
              <button
                className="join-item btn btn-primary"
                disabled={source == null || target == null}
                onMouseDown={() => dijkstraOneStep()}
                title="Run a single step of Dijkstra's algorithm"
              >
                One Step Dijkstra
              </button>
              <button
                className="join-item btn btn-primary w-32"
                disabled={source == null || target == null}
                onClick={dijkstraRunning ? dijkstraStop : dijkstraPlay}
                title={
                  dijkstraRunning
                    ? "Stop the algorithm"
                    : "Run Dijkstra's algorithm automatically"
                }
              >
                {dijkstraRunning ? "Stop Dijkstra" : "Play Dijkstra"}
              </button>
            </div>
            {/* Drawing mode buttons */}
            <div className="join join-horizontal flex justify-center">
              <button
                className="join-item btn btn-primary"
                onClick={() => setDrawingMode("blocked")}
              >
                Wall
                <svg viewBox="0 0 1 1" className="ml-2 size-3">
                  <rect
                    x="0"
                    y="0"
                    width="1"
                    height="1"
                    fill={getVar("--color-base-200")}
                    fillOpacity={drawingMode === "blocked" ? 1 : 0.25}
                  />
                </svg>
              </button>
              <button
                className="join-item btn btn-primary"
                onClick={() => setDrawingMode("passage")}
              >
                Erase
                <svg viewBox="0 0 1 1" className="ml-2 size-3">
                  <rect
                    x="0"
                    y="0"
                    width="1"
                    height="1"
                    fill={getVar("--color-base-100")}
                    fillOpacity={drawingMode === "passage" ? 1 : 0.25}
                  />
                </svg>
              </button>
              <button
                className="join-item btn btn-primary"
                onClick={() => setDrawingMode("source")}
              >
                Source
                <svg viewBox="0 0 1 1" className="ml-2 size-3">
                  <rect
                    x="0"
                    y="0"
                    width="1"
                    height="1"
                    fill={getVar("--color-error")}
                    fillOpacity={drawingMode === "source" ? 1 : 0.25}
                  />
                </svg>
              </button>
              <button
                className="join-item btn btn-primary"
                onClick={() => setDrawingMode("target")}
              >
                Target
                <svg viewBox="0 0 1 1" className="ml-2 size-3">
                  <rect
                    x="0"
                    y="0"
                    width="1"
                    height="1"
                    fill={getVar("--color-success")}
                    fillOpacity={drawingMode === "target" ? 1 : 0.25}
                  />
                </svg>
              </button>
            </div>
            {/* Canvas container */}
            <div className="flex w-full items-center justify-center">
              <div className="relative mx-auto flex w-[700px] items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-pointer touch-none select-none rounded-3xl border-4 border-primary border-dashed shadow-md"
                  style={{ imageRendering: "pixelated" }}
                  onMouseDown={handlePointerDown}
                  onMouseUp={handlePointerUp}
                  onMouseMove={handlePointerMove}
                  onMouseLeave={handlePointerLeave}
                  onTouchStart={(e) => {
                    handlePointerDown(
                      e
                        .touches[0] as unknown as React.PointerEvent<HTMLCanvasElement>
                    );
                  }}
                  onTouchEnd={(e) => {
                    handlePointerUp(
                      e
                        .changedTouches[0] as unknown as React.PointerEvent<HTMLCanvasElement>
                    );
                  }}
                  onTouchMove={(e) => {
                    handlePointerMove(
                      e
                        .touches[0] as unknown as React.PointerEvent<HTMLCanvasElement>
                    );
                  }}
                  onTouchCancel={(e) => {
                    handlePointerLeave(
                      e
                        .changedTouches[0] as unknown as React.PointerEvent<HTMLCanvasElement>
                    );
                  }}
                />
                {source != null && (
                  <div
                    className="dijkstra-source-node tooltip tooltip-top tooltip-open tooltip-error absolute font-bold opacity-80"
                    data-tip="Source Node"
                  />
                )}
                {target != null && (
                  <div
                    className="dijkstra-target-node tooltip tooltip-top tooltip-open tooltip-success absolute font-bold opacity-80"
                    data-tip="Target Node"
                  />
                )}
                <div className="bg-transparent text-center font-bold">
                  {source === null && (
                    <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-error/40 px-3 py-1 mt-2 text-sm shadow-md">
                      Select "Source" and click on the grid to place a source
                      node. Also add walls to make the pathfinding more interesting.
                    </div>
                  )}
                  {source !== null && target === null && (
                    <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-success/40 px-3 py-1 mt-2 text-sm shadow-md">
                      Select "Target" and click on the grid to place a target
                      node
                    </div>
                  )}
                  {source !== null && target !== null && dijkstraRunning && (
                    <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-primary/40 px-3 py-1 mt-2 text-sm shadow-md">
                      Dijkstra's algorithm running...
                    </div>
                  )}
                  {source !== null &&
                    target !== null &&
                    !dijkstraRunning &&
                    pathFound && (
                      <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-secondary/40 px-3 py-1 mt-2 text-sm shadow-md">
                        Path found! Length: {pathLength}
                      </div>
                    )}
                </div>
              </div>
            </div>
            {/* Clear buttons */}
            <div className="join join-horizontal flex items-center justify-center">
              <button
                className="join-item btn btn-primary"
                onClick={clearMaze}
                title="Clear the entire grid and all algorithm results"
              >
                Clear All
              </button>
              <button
                className="join-item btn btn-primary"
                disabled={source == null || target == null}
                onClick={clearDijkstraResults}
                title="Clear only the algorithm results, preserving walls and source/target"
              >
                Clear Dijkstra
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
