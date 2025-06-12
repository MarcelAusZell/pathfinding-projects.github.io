import { useRef, useEffect, useState, use } from "react";

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

function getVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

export default function PrimMazeGeneration() {
  /* ==== STATES ==== */
  const [cols, setCols] = useState(99);
  const [rows, setRows] = useState(99);
  const [source, setSource] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const [dijkstraChunkSize, setDijkstraChunkSize] = useState(1);
  const [primChunkSize, setPrimChunkSize] = useState(1);
  const [dijkstraRunning, setDijkstraRunning] = useState(false);
  const [primRunning, setPrimRunning] = useState(false);
  const [dijkstraPaused, setDijkstraPaused] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [drawingMode, setDrawingMode] = useState("");

  /* ==== REFS ==== */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<cellType[][]>([]);
  const frontierListRef = useRef<{ x: number; y: number }[]>([]);
  const distancesRef = useRef<number[][]>([]);
  const visitedRef = useRef<Boolean[][]>([]);
  const predecessorsRef = useRef<{ x: number; y: number }[][]>([]);
  const dijkstraQueueRef = useRef<{ x: number; y: number; dist: number }[]>([]);
  const primRunningRef = useRef(false);
  const dijkstraRunningRef = useRef(false);
  const primChunkSizeRef = useRef(primChunkSize);
  const dijkstraChunkSizeRef = useRef(dijkstraChunkSize);

  /* ==== GRID AND DRAWING LOGIC ==== */
  function isInBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < cols && y < rows;
  }

  function drawCell(x: number, y: number, status: cellType["status"]) {
    const ctx = canvasRef.current!.getContext("2d")!;
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
        ctx.fillStyle = getVar("--color-info");
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
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = cols;
    canvas.height = rows;

    const grid: cellType[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "blocked" }))
    );
    cellsRef.current = grid;
    grid.forEach((row, y) => row.forEach((_, x) => drawCell(x, y, "blocked")));

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
  }, [rows, cols]);

  useEffect(() => {
    dijkstraChunkSizeRef.current = dijkstraChunkSize;
  }, [dijkstraChunkSize]);

  useEffect(() => {
    primChunkSizeRef.current = primChunkSize;
  }, [primChunkSize]);

  useEffect(() => {
    const randOdd = (max: number) => {
      const n = Math.floor(Math.random() * Math.floor(max / 2)) * 2 + 1;
      return Math.min(n, max - 1);
    };
    primInitialization(randOdd(cols), randOdd(rows));
  }, [rows, cols]);

  useEffect(() => {
    if (source && target) {
      dijkstraInitialization();
    }
  }, [source, target]);

  /* ==== PRIM ALGORITHM LOGIC ==== */
  function primInitialization(x: number, y: number): void {
    // Always start from “blocked” grid
    const grid: cellType[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "blocked" }))
    );

    const directions = [
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
    ];

    // Pick a random Cell, set it to state Passage and compute its frontier cells.
    // A frontier cell of a Cell is a cell with distance 2 in state Blocked and within the grid.
    const startX = x;
    const startY = y;
    grid[startY][startX].status = "passage";
    drawCell(startX, startY, "passage");

    const frontierList: { x: number; y: number }[] = [];
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
  }

  function primOneStep() {
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
      // Pick a random frontier cell from the list of frontier cells (and remove it from the list)
      const randomIndex = Math.floor(Math.random() * frontierList.length);
      const { x, y } = frontierList.splice(randomIndex, 1)[0];

      const passageNeighbours = directions
        .map(({ dx, dy }) => ({ x: x + dx, y: y + dy }))
        .filter(
          (cand) =>
            isInBounds(cand.x, cand.y) &&
            updatedCells[cand.y][cand.x].status === "passage"
        );

      // Compute frontierCell Neighbours which are all cells in distance 2 in state passage.
      // Pick a random neighbor and connect the frontier cell with the neighbor
      // by setting the cell in-between to state passage.
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

        // Compute the frontier cells of the chosen frontier cell and add them to the frontier list.
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
  }

  function primPlay() {
    if (primRunningRef.current) return;
    primRunningRef.current = true;
    setPrimRunning(true);
    primStepLoop();
    setPrimChunkSize((cols + rows) / 40);
  }
  function primStop() {
    primRunningRef.current = false;
    setPrimRunning(false);
    setPrimChunkSize(1);
  }
  function primStepLoop() {
    if (!primRunningRef.current) return;
    primOneStep();
    // Check if finished (no more frontier cells)
    if (frontierListRef.current.length === 0) {
      primRunningRef.current = false;
      setPrimRunning(false);
      return;
    }
    requestAnimationFrame(primStepLoop);
  }

  /* ==== DIJKSTRA ALGORITHM LOGIC ==== */
  function dijkstraInitialization() {
    // Reset visited and redraw
    visitedRef.current.forEach((row, y) => {
      row.forEach((_, x) => {
        visitedRef.current[y][x] = false;
      });
    });
    cellsRef.current.forEach((row, y) =>
      row.forEach((cell, x) => drawCell(x, y, cell.status))
    );

    // Initializations
    const distances = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(Number.POSITIVE_INFINITY));
    const visited = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    const predecessors = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null));
    if (!source || !target) {
      return;
    }

    distances[source.y][source.x] = 0;
    predecessors[source.y][source.x] = source;

    visitedRef.current = visited;
    predecessorsRef.current = predecessors;
    distancesRef.current = distances;

    dijkstraQueueRef.current = [{ x: source.x, y: source.y, dist: 0 }];
  }

  function dijkstraOneStep() {
    let distances = distancesRef.current;
    let visited = visitedRef.current;
    let predecessors = predecessorsRef.current;
    let cells = cellsRef.current;
    let queue = dijkstraQueueRef.current;
    if (!source || !target) {
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
      // Use a min-heap for more efficient distance retrieval (previously O(n^2) but now O(n log n) due to sorting)
      // Sort queue by distance (min-heap simulation)
      queue.sort((a, b) => a.dist - b.dist);
      // Remove the cell with the smallest distance
      const current = queue.shift();
      // If the queue is empty then break
      if (!current) break;
      const { x, y } = current;
      // If the cell is already visited, continue
      if (visited[y][x]) continue;
      // Otherwise, mark it as visited (if it is not source or target)
      visited[y][x] = true;
      if (cells[y][x].status !== "source" && cells[y][x].status !== "target") {
        cells[y][x].status = "visited";
        drawCell(x, y, "visited");
      }

      // Explore neighbors
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
    predecessors: { x: number; y: number }[][]
  ) {
    // Reconstruct the path:
    const path: { x: number; y: number }[] = [];
    let u = target;
    while (u) {
      path.push(u);
      if (u.x === source.x && u.y === source.y) break;
      u = predecessors[u.y][u.x];
    }

    // Now animate one cell per frame:
    let i = 1;
    function step() {
      if (i >= path.length - 1) return;
      const { x, y } = path[i++];
      cellsRef.current[y][x].status = "shortestPath";
      drawCell(x, y, "shortestPath");
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function dijkstraPlay() {
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

  function dijkstraStop() {
    dijkstraRunningRef.current = false;
    setDijkstraRunning(false);
    setDijkstraPaused(true);
    setDijkstraChunkSize(1);
  }
  function dijkstraStepLoop() {
    if (!dijkstraRunningRef.current) return;
    dijkstraOneStep();
    // Check if finished (target visited)
    if (target && visitedRef.current[target.y][target.x]) {
      dijkstraRunningRef.current = false;
      setDijkstraRunning(false);
      return;
    }
    requestAnimationFrame(dijkstraStepLoop);
  }

  /* ==== GRID INTERACTION AND CLEARING ==== */
  function handleMouseClick(event: React.MouseEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // How many real (internal) pixels per CSS pixel:
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // Mouse offset in CSS px:
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    // Map to grid‐coords:
    const currentCellX = Math.floor(mouseX * scaleX);
    const currentCellY = Math.floor(mouseY * scaleY);

    if (
      drawingMode == "source" &&
      cellsRef.current[currentCellY][currentCellX].status == "passage"
    ) {
      // Clear Dijkstra results when placing a new source
      clearDijkstraResults();

      // Remove previous start node
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
      drawingMode == "target" &&
      cellsRef.current[currentCellY][currentCellX].status == "passage"
    ) {
      // Clear Dijkstra results when placing a new target
      clearDijkstraResults();

      // Remove previous end node
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
    // Reset references and states
    frontierListRef.current = [];
    setSource(null);
    setTarget(null);
    setDrawingMode("");
    setDijkstraRunning(false);
    setPrimRunning(false);
    dijkstraRunningRef.current = false;
    primRunningRef.current = false;
    dijkstraQueueRef.current = [];

    // Initialize blank grid
    const blankGrid: cellType[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ status: "blocked" }))
    );

    // Reset distances, visited, and predecessors
    distancesRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Number.POSITIVE_INFINITY)
    );
    visitedRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => false)
    );
    predecessorsRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ x: -1, y: -1 }))
    );

    cellsRef.current = blankGrid;

    // Draw all cells as blocked first
    cellsRef.current.forEach((row, y) =>
      row.forEach((cell, x) => {
        drawCell(x, y, "blocked");
      })
    );

    // Now initialize Prim after the grid is reset
    const randOdd = (max: number) => {
      const n = Math.floor(Math.random() * Math.floor(max / 2)) * 2 + 1;
      return Math.min(n, max - 1);
    };

    primInitialization(randOdd(cols), randOdd(rows));

  }

  function clearDijkstraResults() {
    dijkstraRunningRef.current = false;
    setDijkstraRunning(false);
    setDijkstraPaused(false);
    dijkstraQueueRef.current = [];

    cellsRef.current.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.status === "visited" || cell.status === "shortestPath") {
          cell.status = "passage";
          drawCell(x, y, "passage");
        }
      });
    });

    if (source) {
      cellsRef.current[source.y][source.x].status = "source";
      drawCell(source.x, source.y, "source");
    }

    if (target) {
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

  useEffect(() => {
    function handleResize() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function setHTMLOverlayToCanvas(
    gridPos: { x: number; y: number },
    htmlEl: HTMLElement
  ) {
    const canvas = canvasRef.current!;
    const container = canvas.parentElement!;

    const canvasRect = canvas.getBoundingClientRect();
    const cellW = canvasRect.width / cols;
    const cellH = canvasRect.height / rows;

    // How far in from the container's padding+border the canvas starts:
    const offsetX =
      canvas.clientLeft + parseFloat(getComputedStyle(container).paddingLeft);
    const offsetY =
      canvas.clientTop + parseFloat(getComputedStyle(container).paddingTop);

    // Calculate the position of the HTML element based on the grid position
    const left = offsetX + gridPos.x * cellW + cellW / 2;
    const top = offsetY + gridPos.y * cellH;

    htmlEl.style.left = `${left}px`;
    htmlEl.style.top = `${top}px`;
    htmlEl.style.transform = `translate(-50%, -100%)`;
  }

  useEffect(() => {
    if (!source) return;
    const sourceElement = document.querySelector(
      ".prim-source-node"
    ) as HTMLElement;
    if (sourceElement) {
      setHTMLOverlayToCanvas(source, sourceElement);
    }
  }, [dimensions, source]);

  useEffect(() => {
    if (!target) return;
    const targetElement = document.querySelector(
      ".prim-target-node"
    ) as HTMLElement;
    if (targetElement) {
      setHTMLOverlayToCanvas(target, targetElement);
    }
  }, [dimensions, target]);

  return (
    <>
      <div className="mockup-window bg-base-200 shadow-lg overflow-hidden">
        <div className="pl-11 pr-11">
          <div className="flex-col items-center">
            <div className="flex flex-col justify-center w-full mb-2 gap-2">
              {/* Buttons Prim */}
              <div className="join join-horizontal flex justify-center">
                <button
                  className="btn  btn-primary join-item w-36"
                  onMouseDown={() => primOneStep()}
                >
                  One Step Prim
                </button>
                <button
                  className="btn btn-primary join-item w-36"
                  onClick={() => (primRunning ? primStop() : primPlay())}
                >
                  {primRunning ? "Stop Prim" : "Play Prim"}
                </button>
              </div>

              {/* Buttons Dijkstra */}
              <div className="join join-horizontal flex justify-center">
                <button
                  className="btn  btn-primary join-item "
                  onClick={() => setDrawingMode("source")}
                >
                  Source
                  <svg viewBox="0 0 1 1" className="w-3 h-3 ml-2">
                    <rect
                      x="0"
                      y="0"
                      width="1"
                      height="1"
                      fill={getVar("--color-error")}
                      fillOpacity={`${drawingMode === "source" ? 1 : 0.25}`}
                    />
                  </svg>
                </button>
                <button
                  className="btn  btn-primary join-item"
                  onClick={() => setDrawingMode("target")}
                >
                  Target
                  <svg viewBox="0 0 1 1" className="w-3 h-3 ml-2">
                    <rect
                      x="0"
                      y="0"
                      width="1"
                      height="1"
                      fill={getVar("--color-info")}
                      fillOpacity={`${drawingMode === "target" ? 1 : 0.25}`}
                    />
                  </svg>
                </button>

                <button
                  className="btn  btn-primary join-item"
                  disabled={!source || !target}
                  onMouseDown={() => dijkstraOneStep()}
                >
                  One Step Dijkstra
                </button>
                <button
                  className="btn btn-primary join-item w-32"
                  disabled={!source || !target}
                  onClick={dijkstraRunning ? dijkstraStop : dijkstraPlay}
                >
                  {dijkstraRunning ? "Stop Dijkstra" : "Play Dijkstra"}
                </button>
              </div>
            </div>

            <div className="relative max-w-[600px] mx-auto">
              <canvas
                ref={canvasRef}
                className="w-full select-none cursor-pointer touch-none"
                style={{ imageRendering: "pixelated" }}
                onMouseDown={handleMouseClick}
              />
              {source && (
                <div
                  className="prim-source-node tooltip tooltip-open tooltip-top opacity-80 absolute tooltip-error font-bold"
                  data-tip="Source Node"
                />
              )}
              {target && (
                <div
                  className="prim-target-node tooltip tooltip-open tooltip-top opacity-80 absolute tooltip-info font-bold"
                  data-tip="Target Node"
                />
              )}
            </div>
          </div>

          {/* Clearing  */}
          <div className="flex flex-col items-center">
            <div className="flex text-center items-center  mt-2 p-2 join join-horizontal">
              <button
                className="btn  btn-primary join-item"
                onClick={clearMaze}
              >
                Clear All
              </button>
              <button
                className="btn btn-primary join-item"
                disabled={!source || !target}
                onClick={clearDijkstraResults}
              >
                Clear Dijkstra
              </button>
            </div>
            <div className="flex flex-col w-full text-center items-center p-4">
              <input
                type="range"
                min={5}
                max={251}
                value={rows}
                step={2}
                className="range range-sm range-primary w-full opacity-40"
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setRows(value);
                  setCols(value);
                  setPrimChunkSize(1);
                  setDijkstraChunkSize(1);
                  setSource(null);
                  setTarget(null);
                }}
              />
              <span className="text-sm opacity-40 mt-2">Maze Size</span>
              <span className="mt-1 text-sm font-semibold opacity-40">
                {rows} x {cols}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
