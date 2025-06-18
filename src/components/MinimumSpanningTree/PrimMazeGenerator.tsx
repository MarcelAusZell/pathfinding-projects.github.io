import { useRef, useEffect, useState } from "react";

interface cellType {
  status:
    | "blocked"
    | "passage"
    | "frontier"
    | "visited"
    | "source"
    | "target"
    | "shortestPath";
}

export default function PrimMazeGeneration() {
  /* ==== STATES ==== */
  const [cols, setCols] = useState<number>(99);
  const [rows, setRows] = useState<number>(99);
  const [source, setSource] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const [dijkstraChunkSize, setDijkstraChunkSize] = useState<number>(1);
  const [primChunkSize, setPrimChunkSize] = useState<number>(1);
  const [dijkstraRunning, setDijkstraRunning] = useState<boolean>(false);
  const [primRunning, setPrimRunning] = useState<boolean>(false);
  const [dijkstraPaused, setDijkstraPaused] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });
  const [drawingMode, setDrawingMode] = useState<string>("");
  const [isMazeComplete, setIsMazeComplete] = useState<boolean>(false);

  function getVar(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name);
  }

  /* ==== REFS ==== */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<cellType[][]>([]);
  const frontierListRef = useRef<Array<{ x: number; y: number }>>([]);
  const distancesRef = useRef<number[][]>([]);
  const visitedRef = useRef<boolean[][]>([]);
  const predecessorsRef = useRef<Array<Array<{ x: number; y: number } | null>>>(
    []
  );
  const dijkstraQueueRef = useRef<
    Array<{ x: number; y: number; dist: number }>
  >([]);
  const primRunningRef = useRef<boolean>(false);
  const dijkstraRunningRef = useRef<boolean>(false);
  const primChunkSizeRef = useRef<number>(primChunkSize);
  const dijkstraChunkSizeRef = useRef<number>(dijkstraChunkSize);
  const shortestPathAnimatingRef = useRef(false);

  /* ==== GRID AND DRAWING LOGIC ==== */
  function isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < cols && y < rows;
  }

  function drawCell(x: number, y: number, status: cellType["status"]): void {
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

  /* ==== CANVAS SETUP AND OBSERVERS ==== */
  useEffect((): void => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    canvas.width = cols;
    canvas.height = rows;
    const grid: cellType[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "blocked" }))
    );
    cellsRef.current = grid;
    grid.forEach((row, y) => row.forEach((_, x) => drawCell(x, y, "blocked")));
    const observer = new MutationObserver(() => {
      cellsRef.current.forEach((row, y) =>
        row.forEach((cell, x) => drawCell(x, y, cell.status))
      );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return undefined;
  }, [rows, cols]);

  useEffect((): void => {
    dijkstraChunkSizeRef.current = dijkstraChunkSize;
  }, [dijkstraChunkSize]);

  useEffect((): void => {
    primChunkSizeRef.current = primChunkSize;
  }, [primChunkSize]);

  useEffect((): void => {
    const randOdd = (max: number): number => {
      const n = Math.floor(Math.random() * Math.floor(max / 2)) * 2 + 1;
      return Math.min(n, max - 1);
    };
    primInitialization(randOdd(cols), randOdd(rows));
  }, [rows, cols]);

  useEffect((): void => {
    if (source === null || target === null) return;
    dijkstraInitialization();
  }, [source, target]);

  function primInitialization(x: number, y: number): void {
    const grid: cellType[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "blocked" }))
    );
    const directions = [
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
    ];
    const startX = x;
    const startY = y;
    grid[startY][startX].status = "passage";
    drawCell(startX, startY, "passage");
    const frontierList: Array<{ x: number; y: number }> = [];
    directions.forEach(({ dx, dy }) => {
      const nx = startX + dx;
      const ny = startY + dy;
      if (isInBounds(nx, ny) && grid[ny][nx].status === "blocked") {
        frontierList.push({ x: nx, y: ny });
        grid[ny][nx].status = "frontier";
        drawCell(nx, ny, "frontier");
      }
    });
    frontierListRef.current = frontierList;
    cellsRef.current = grid;
    setIsMazeComplete(false);
    setDrawingMode("");
    setSource(null);
    setTarget(null);
  }

  function primOneStep(): void {
    const frontierList = frontierListRef.current;
    const updatedCells = cellsRef.current;
    const directions = [
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
    ];
    let i = 0;
    while (i++ < primChunkSizeRef.current && frontierList.length > 0) {
      const randomIndex = Math.floor(Math.random() * frontierList.length);
      const { x, y } = frontierList.splice(randomIndex, 1)[0];
      const passageNeighbours = directions
        .map(({ dx, dy }) => ({ x: x + dx, y: y + dy }))
        .filter(
          (cand) =>
            isInBounds(cand.x, cand.y) &&
            updatedCells[cand.y][cand.x].status === "passage"
        );
      if (passageNeighbours.length > 0) {
        const neighbor =
          passageNeighbours[
            Math.floor(Math.random() * passageNeighbours.length)
          ];
        const betweenX = (x + neighbor.x) / 2;
        const betweenY = (y + neighbor.y) / 2;
        updatedCells[betweenY][betweenX].status = "passage";
        drawCell(betweenX, betweenY, "passage");
        updatedCells[y][x].status = "passage";
        drawCell(x, y, "passage");
        directions.forEach(({ dx, dy }) => {
          const nx = x + dx;
          const ny = y + dy;
          if (isInBounds(nx, ny) && updatedCells[ny][nx].status === "blocked") {
            updatedCells[ny][nx].status = "frontier";
            drawCell(nx, ny, "frontier");
            frontierList.push({ x: nx, y: ny });
          }
        });
      }
    }
    if (frontierList.length === 0) {
      setIsMazeComplete(true);
      setDrawingMode("source");
    }
  }

  function primPlay(): void {
    if (primRunningRef.current) return;
    primRunningRef.current = true;
    setPrimRunning(true);
    setIsMazeComplete(false);
    primStepLoop();
    setPrimChunkSize((cols + rows) / 20);
  }
  function primStop(): void {
    primRunningRef.current = false;
    setPrimRunning(false);
    setPrimChunkSize(1);
  }
  function primStepLoop(): void {
    if (!primRunningRef.current) return;
    primOneStep();
    if (frontierListRef.current.length === 0) {
      primRunningRef.current = false;
      setPrimRunning(false);
      setIsMazeComplete(true);
      setDrawingMode("source");
      return;
    }
    requestAnimationFrame(primStepLoop);
  }

  /* ==== DIJKSTRA ALGORITHM LOGIC ==== */
  function dijkstraInitialization(): void {
    visitedRef.current.forEach((row, y) => {
      row.forEach((_, x) => {
        visitedRef.current[y][x] = false;
      });
    });
    cellsRef.current.forEach((row, y) =>
      row.forEach((cell, x) => drawCell(x, y, cell.status))
    );
    const distances: number[][] = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(Number.POSITIVE_INFINITY));
    const visited: boolean[][] = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    const predecessors: Array<Array<{ x: number; y: number } | null>> = Array(
      rows
    )
      .fill(null)
      .map(() => Array(cols).fill(null));
    if (source === null || target === null) {
      return;
    }
    distances[source.y][source.x] = 0;
    predecessors[source.y][source.x] = source;
    visitedRef.current = visited;
    predecessorsRef.current = predecessors;
    distancesRef.current = distances;
    dijkstraQueueRef.current = [{ x: source.x, y: source.y, dist: 0 }];
  }

  function dijkstraOneStep(): void {
    // Auto-initialize if needed
    if (
      dijkstraQueueRef.current.length === 0 ||
      distancesRef.current.length === 0 ||
      visitedRef.current.length === 0 ||
      predecessorsRef.current.length === 0
    ) {
      if (source !== null && target !== null) {
        dijkstraInitialization();
      }
    }
    const distances = distancesRef.current;
    const visited = visitedRef.current;
    const predecessors = predecessorsRef.current;
    const cells = cellsRef.current;
    const queue = dijkstraQueueRef.current;
    if (source === null || target === null) {
      return;
    }
    const { x: targetX, y: targetY } = target;
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];
    if (visited[targetY][targetX]) {
      animateShortestPath(source, target, predecessorsRef.current);
      return;
    }
    let count = 0;
    while (count++ < dijkstraChunkSizeRef.current && queue.length > 0) {
      queue.sort((a, b) => a.dist - b.dist);
      const current = queue.shift();
      if (current === undefined) break;
      const { x, y } = current;
      if (visited[y][x]) continue;
      visited[y][x] = true;
      if (cells[y][x].status !== "source" && cells[y][x].status !== "target") {
        cells[y][x].status = "visited";
        drawCell(x, y, "visited");
      }
      directions.forEach(({ dx, dy }) => {
        const nx = x + dx;
        const ny = y + dy;
        if (
          isInBounds(nx, ny) &&
          !visited[ny][nx] &&
          (cells[ny][nx].status === "passage" ||
            cells[ny][nx].status === "target")
        ) {
          if (distances[y][x] + 1 < distances[ny][nx]) {
            distances[ny][nx] = distances[y][x] + 1;
            predecessors[ny][nx] = { x, y };
            queue.push({ x: nx, y: ny, dist: distances[ny][nx] });
          }
        }
      });
      if (visited[targetY][targetX]) break;
    }
    if (visited[targetY][targetX]) {
      animateShortestPath(source, target, predecessorsRef.current);
    }
  }

  function animateShortestPath(
    source: { x: number; y: number },
    target: { x: number; y: number },
    predecessors: Array<Array<{ x: number; y: number } | null>>
  ): void {
    const path: Array<{ x: number; y: number }> = [];
    let u: { x: number; y: number } | null = target;
    while (u !== null) {
      path.push(u);
      if (u.x === source.x && u.y === source.y) break;
      u = predecessors[u.y][u.x];
    }
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

  function dijkstraPlay(): void {
    if (!dijkstraPaused) {
      clearDijkstraResults();
      dijkstraInitialization();
    }
    if (dijkstraRunningRef.current) return;
    dijkstraRunningRef.current = true;
    setDijkstraRunning(true);
    setDijkstraPaused(false);
    dijkstraStepLoop();
    setDijkstraChunkSize((cols + rows) / 16);
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
    if (target !== null && visitedRef.current[target.y][target.x]) {
      dijkstraRunningRef.current = false;
      setDijkstraRunning(false);
      return;
    }
    requestAnimationFrame(dijkstraStepLoop);
  }

  /* ==== GRID INTERACTION AND CLEARING ==== */
  function handleMouseClick(event: React.MouseEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (canvas === null || !isMazeComplete) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const currentCellX = Math.floor(mouseX * scaleX);
    const currentCellY = Math.floor(mouseY * scaleY);
    if (
      drawingMode === "source" &&
      cellsRef.current[currentCellY][currentCellX].status === "passage"
    ) {
      clearDijkstraResults();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (cellsRef.current[y][x].status === "source") {
            cellsRef.current[y][x].status = "passage";
            drawCell(x, y, "passage");
          }
        }
      }
      setSource({ x: currentCellX, y: currentCellY });
      cellsRef.current[currentCellY][currentCellX].status = "source";
      drawCell(currentCellX, currentCellY, "source");
      setDrawingMode("target");
    } else if (
      drawingMode === "target" &&
      cellsRef.current[currentCellY][currentCellX].status === "passage"
    ) {
      clearDijkstraResults();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (cellsRef.current[y][x].status === "target") {
            cellsRef.current[y][x].status = "passage";
            drawCell(x, y, "passage");
          }
        }
      }
      setTarget({ x: currentCellX, y: currentCellY });
      cellsRef.current[currentCellY][currentCellX].status = "target";
      drawCell(currentCellX, currentCellY, "target");
      setDrawingMode("source");
    }
  }

  function clearMaze(): void {
    frontierListRef.current = [];
    setSource(null);
    setTarget(null);
    setDrawingMode("");
    setDijkstraRunning(false);
    setPrimRunning(false);
    dijkstraRunningRef.current = false;
    primRunningRef.current = false;
    dijkstraQueueRef.current = [];
    setIsMazeComplete(false);
    shortestPathAnimatingRef.current = false;
    cellsRef.current.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.status === "visited" || cell.status === "shortestPath") {
          cell.status = "passage";
          drawCell(x, y, "passage");
        }
      });
    });
    const blankGrid: cellType[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "blocked" }))
    );
    distancesRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Number.POSITIVE_INFINITY)
    );
    visitedRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => false)
    );
    predecessorsRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    );
    cellsRef.current = blankGrid;
    cellsRef.current.forEach((row, y) =>
      row.forEach((cell, x) => {
        drawCell(x, y, "blocked");
      })
    );
    const randOdd = (max: number): number => {
      const n = Math.floor(Math.random() * Math.floor(max / 2)) * 2 + 1;
      return Math.min(n, max - 1);
    };
    primInitialization(randOdd(cols), randOdd(rows));
  }

  function clearDijkstraResults(): void {
    dijkstraRunningRef.current = false;
    setDijkstraRunning(false);
    setDijkstraPaused(false);
    dijkstraQueueRef.current = [];
    shortestPathAnimatingRef.current = false;
    cellsRef.current.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.status === "visited" || cell.status === "shortestPath") {
          cell.status = "passage";
          drawCell(x, y, "passage");
        }
      });
    });
    if (source !== null) {
      cellsRef.current[source.y][source.x].status = "source";
      drawCell(source.x, source.y, "source");
    }
    if (target !== null) {
      cellsRef.current[target.y][target.x].status = "target";
      drawCell(target.x, target.y, "target");
    }
    visitedRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    distancesRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(Number.POSITIVE_INFINITY));
    predecessorsRef.current = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null));
  }

  useEffect((): void => {
    function handleResize(): void {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener("resize", handleResize);
    return undefined;
  }, []);

  function setHTMLOverlayToCanvas(
    gridPos: { x: number; y: number },
    htmlEl: HTMLElement
  ): void {
    const canvas = canvasRef.current!;
    const container = canvas.parentElement!;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const cellW = canvasRect.width / cols;
    const cellH = canvasRect.height / rows;
    const left =
      canvasRect.left - containerRect.left + gridPos.x * cellW + cellW / 2;
    const top = canvasRect.top - containerRect.top + gridPos.y * cellH;
    htmlEl.style.left = `${left}px`;
    htmlEl.style.top = `${top}px`;
    htmlEl.style.transform = `translate(-50%, -100%)`;
  }

  useEffect((): void => {
    if (source === null) return;
    const sourceElement =
      document.querySelector<HTMLElement>(".prim-source-node");
    if (sourceElement !== null) {
      setHTMLOverlayToCanvas(source, sourceElement);
    }
  }, [dimensions, source]);

  useEffect((): void => {
    if (target === null) return;
    const targetElement =
      document.querySelector<HTMLElement>(".prim-target-node");
    if (targetElement !== null) {
      setHTMLOverlayToCanvas(target, targetElement);
    }
  }, [dimensions, target]);

  return (
    <>
      <div className="px-11">
        <div className="flex-col items-center">
          <div className="mb-2 flex w-full flex-col justify-center gap-2">
            {/* Buttons Prim */}
            <div className="join join-horizontal flex justify-center">
              <button
                className="join-item btn btn-primary w-36"
                onMouseDown={() => {
                  setPrimChunkSize(1);
                  primOneStep();
                }}
                disabled={primRunning || isMazeComplete}
              >
                One Step Prim
              </button>
              <button
                className="join-item btn btn-primary w-36"
                onClick={() => (primRunning ? primStop() : primPlay())}
                disabled={isMazeComplete}
              >
                {primRunning ? "Stop Prim" : "Play Prim"}
              </button>
            </div>
            {/* Buttons Dijkstra */}
            <div className="join join-horizontal flex justify-center">
              <button
                className="join-item btn btn-primary"
                onClick={() => setDrawingMode("source")}
                disabled={!isMazeComplete}
              >
                Source
                <svg viewBox="0 0 1 1" className="ml-2 size-3">
                  <rect
                    x="0"
                    y="0"
                    width="1"
                    height="1"
                    fill={getVar("--color-error")}
                    fillOpacity={`${
                      drawingMode === "source" && isMazeComplete ? 1 : 0.25
                    }`}
                  />
                </svg>
              </button>
              <button
                className="join-item btn btn-primary"
                onClick={() => setDrawingMode("target")}
                disabled={!isMazeComplete}
              >
                Target
                <svg viewBox="0 0 1 1" className="ml-2 size-3">
                  <rect
                    x="0"
                    y="0"
                    width="1"
                    height="1"
                    fill={getVar("--color-success")}
                    fillOpacity={`${
                      drawingMode === "target" && isMazeComplete ? 1 : 0.25
                    }`}
                  />
                </svg>
              </button>
              <button
                className="join-item btn btn-primary"
                disabled={!isMazeComplete || source === null || target === null}
                onMouseDown={() => {
                  setDijkstraChunkSize(1);
                  dijkstraOneStep();
                }}
              >
                One Step Dijkstra
              </button>
              <button
                className="join-item btn btn-primary w-32"
                disabled={!isMazeComplete || source === null || target === null}
                onClick={dijkstraRunning ? dijkstraStop : dijkstraPlay}
              >
                {dijkstraRunning ? "Stop Dijkstra" : "Play Dijkstra"}
              </button>
            </div>
          </div>
          <div className="relative mx-auto flex justify-center">
            <canvas
              ref={canvasRef}
              className="w-[700px] cursor-pointer touch-none select-none shadow-md"
              style={{ imageRendering: "pixelated" }}
              onMouseDown={handleMouseClick}
            />
            {source !== null && (
              <div
                className="prim-source-node tooltip tooltip-top tooltip-open tooltip-error absolute font-bold opacity-80"
                data-tip="Source Node"
              />
            )}
            {target !== null && (
              <div
                className="prim-target-node tooltip tooltip-top tooltip-open tooltip-success absolute font-bold opacity-80"
                data-tip="Target Node"
              />
            )}
            <div className="bg-transparent text-center font-bold">
              {!isMazeComplete && !primRunning && (
                <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-base-300/40 px-3 py-1 text-sm shadow-md">
                  Click "One Step Prim" or "Play Prim" to build the maze
                </div>
              )}
              {primRunning && (
                <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-primary/40 px-3 py-1 text-sm shadow-md">
                  Building maze...
                </div>
              )}
              {isMazeComplete && source === null && target === null && (
                <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-success/40 px-3 py-1 text-sm shadow-md">
                  Maze complete! Place source and target points
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Clearing  */}
        <div className="flex flex-col items-center">
          <div className="join join-horizontal mt-2 flex items-center p-2 text-center">
            <button className="join-item btn btn-primary" onClick={clearMaze}>
              Clear All
            </button>
            <button
              className="join-item btn btn-primary"
              disabled={!isMazeComplete || source === null || target === null}
              onClick={clearDijkstraResults}
            >
              Clear Dijkstra
            </button>
          </div>
          <div className="flex w-full flex-col items-center p-4 text-center">
            <input
              type="range"
              min={5}
              max={251}
              value={rows}
              step={2}
              className="range range-primary range-sm w-full max-w-xs"
              onChange={(e) => {
                const value = Number(e.target.value);
                setRows(value);
                setCols(value);
                setPrimChunkSize(1);
                setDijkstraChunkSize(1);
                setSource(null);
                setTarget(null);
                setIsMazeComplete(false);
              }}
            />
            <span className="mt-2 text-sm opacity-40">Maze Size</span>
            <span className="mt-1 text-sm font-semibold opacity-40">
              {rows} x {cols}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
