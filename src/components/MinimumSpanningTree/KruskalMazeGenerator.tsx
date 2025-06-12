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

function getVar(name: string) {
  if (typeof window !== "undefined") {
    return getComputedStyle(document.documentElement).getPropertyValue(name);
  }
  return "";
}

// Utility function to shuffle an array
function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export default function KruskalMazeGeneration() {
  /* ==== STATES AND REFS ==== */
  const [cols, setCols] = useState(99);
  const [rows, setRows] = useState(99);
  const [source, setSource] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const [dijkstraChunkSize, setDijkstraChunkSize] = useState(1);
  const [kruskalChunkSize, setKruskalChunkSize] = useState(1);
  const [dijkstraRunning, setDijkstraRunning] = useState(false);
  const [kruskalRunning, setKruskalRunning] = useState(false);
  const [dijkstraPaused, setDijkstraPaused] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });
  const [drawingMode, setDrawingMode] = useState("");
  const [numGroups, setNumGroups] = useState(0); 

  /* ==== REFS ==== */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<(cellType & { groupId?: number })[][]>([]);
  const wallsListRef = useRef<{ x: number; y: number }[]>([]);
  const distancesRef = useRef<number[][]>([]);
  const visitedRef = useRef<Boolean[][]>([]);
  const predecessorsRef = useRef<{ x: number; y: number }[][]>([]);
  const dijkstraQueueRef = useRef<{ x: number; y: number; dist: number }[]>([]);
  const kruskalRunningRef = useRef(false);
  const dijkstraRunningRef = useRef(false);
  const kruskalChunkSizeRef = useRef(kruskalChunkSize);
  const dijkstraChunkSizeRef = useRef(dijkstraChunkSize);

  const groupParentsRef = useRef<Map<number, number>>(new Map());
  const groupSizesRef = useRef<Map<number, number>>(new Map());

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

    clearMaze();

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
    kruskalChunkSizeRef.current = kruskalChunkSize;
  }, [kruskalChunkSize]);

  useEffect(() => {
    if (source && target) {
      dijkstraInitialization();
    }
  }, [source, target]);

  /* ==== KRUSKAL ALGORITHM LOGIC (CORRECTED) ==== */
  function kruskalInitialization(): void {
    const cells = cellsRef.current;
    const walls: { x: number; y: number }[] = [];

    groupParentsRef.current = new Map<number, number>();
    groupSizesRef.current = new Map<number, number>();
    let groupCounter = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (y % 2 === 0 && x % 2 === 0) {
          cells[y][x].status = "passage";
          cells[y][x].groupId = groupCounter;
          drawCell(x, y, "passage");

          groupParentsRef.current.set(groupCounter, groupCounter);
          groupSizesRef.current.set(groupCounter, 1);
          groupCounter++;

          if (x < cols - 1) walls.push({ x: x + 1, y: y });
          if (y < rows - 1) walls.push({ x: x, y: y + 1 });
        } else {
          cells[y][x].status = "blocked";
          drawCell(x, y, "blocked");
        }
      }
    }

    shuffleArray(walls);
    wallsListRef.current = walls;
    setNumGroups(groupCounter); 
  }

  function findRoot(id: number): number {
    const parents = groupParentsRef.current;
    if (parents.get(id) === id) return id;
    const root = findRoot(parents.get(id)!);
    parents.set(id, root); 
    return root;
  }

  function union(id1: number, id2: number): void {
    const root1 = findRoot(id1);
    const root2 = findRoot(id2);

    if (root1 === root2) return;

    const parents = groupParentsRef.current;
    const sizes = groupSizesRef.current;
    const size1 = sizes.get(root1) || 1;
    const size2 = sizes.get(root2) || 1;

    if (size1 < size2) {
      parents.set(root1, root2);
      sizes.set(root2, size1 + size2);
    } else {
      parents.set(root2, root1);
      sizes.set(root1, size1 + size2);
    }
    setNumGroups((prev) => prev - 1);
  }

  function kruskalOneStep() {
    if (wallsListRef.current.length === 0 || numGroups <= 1) {
      kruskalRunningRef.current = false;
      setKruskalRunning(false);
      return true;
    }

    let steps = 0;
    while (
      steps < kruskalChunkSizeRef.current &&
      wallsListRef.current.length > 0
    ) {
      const wall = wallsListRef.current.pop();
      if (!wall) break;

      let cellA, cellB;
      if (wall.x % 2 !== 0) {
        cellA = { x: wall.x - 1, y: wall.y };
        cellB = { x: wall.x + 1, y: wall.y };
      } else {
        cellA = { x: wall.x, y: wall.y - 1 };
        cellB = { x: wall.x, y: wall.y + 1 };
      }

      if (!isInBounds(cellA.x, cellA.y) || !isInBounds(cellB.x, cellB.y))
        continue;

      const groupIDCellA = cellsRef.current[cellA.y][cellA.x].groupId;
      const groupIDCellB = cellsRef.current[cellB.y][cellB.x].groupId;

      if (groupIDCellA === undefined || groupIDCellB === undefined) continue;

      if (findRoot(groupIDCellA) !== findRoot(groupIDCellB)) {
        cellsRef.current[wall.y][wall.x].status = "passage";
        drawCell(wall.x, wall.y, "passage");
        union(groupIDCellA, groupIDCellB);
        steps++;
      }
    }

    const done = numGroups <= 1; 
    if (done) {
      kruskalRunningRef.current = false;
      setKruskalRunning(false);
    }
    return done;
  }

  function kruskalPlay() {
    if (kruskalRunningRef.current) return;
    kruskalRunningRef.current = true;
    setKruskalRunning(true);
    setKruskalChunkSize(Math.floor((cols + rows) / 4));
    kruskalStepLoop();
  }

  function kruskalStop() {
    kruskalRunningRef.current = false;
    setKruskalRunning(false);
    setKruskalChunkSize(1);
  }

  function kruskalStepLoop() {
    if (!kruskalRunningRef.current) return;
    if (kruskalOneStep()) return;
    requestAnimationFrame(kruskalStepLoop);
  }

  /* ==== DIJKSTRA ALGORITHM LOGIC ==== */
  function dijkstraInitialization() {
    visitedRef.current.forEach((row, y) => {
      row.forEach((_, x) => {
        visitedRef.current[y][x] = false;
      });
    });
    cellsRef.current.forEach((row, y) =>
      row.forEach((cell, x) => drawCell(x, y, cell.status))
    );

    const distances = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(Number.POSITIVE_INFINITY));
    const visited = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    const predecessors = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null));
    if (!source || !target) return;

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
    if (!source || !target) return;
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
      if (!current) break;
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
    predecessors: { x: number; y: number }[][]
  ) {
    const path: { x: number; y: number }[] = [];
    let u = target;
    while (u) {
      path.push(u);
      if (u.x === source.x && u.y === source.y) break;
      u = predecessors[u.y][u.x];
    }
    let i = path.length - 2;
    function step() {
      if (i < 1) return;
      const { x, y } = path[i--];
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
    setDijkstraChunkSize(Math.floor((cols + rows) / 16));
    dijkstraStepLoop();
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
      if (source) {
        cellsRef.current[source.y][source.x].status = "passage";
        drawCell(source.x, source.y, "passage");
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
      if (target) {
        cellsRef.current[target.y][target.x].status = "passage";
        drawCell(target.x, target.y, "passage");
      }
      setTarget({ x: currentCellX, y: currentCellY });
      cellsRef.current[currentCellY][currentCellX].status = "target";
      drawCell(currentCellX, currentCellY, "target");
      setDrawingMode("source");
    }
  }

  function clearMaze(): void {
    wallsListRef.current = [];
    setSource(null);
    setTarget(null);
    setDrawingMode("source");
    setDijkstraRunning(false);
    setKruskalRunning(false);
    dijkstraRunningRef.current = false;
    kruskalRunningRef.current = false;
    dijkstraQueueRef.current = [];

    const blankGrid: (cellType & { groupId?: number })[][] = Array.from(
      { length: rows },
      () => Array.from({ length: cols }, () => ({ status: "blocked" }))
    );
    cellsRef.current = blankGrid;
    kruskalInitialization();
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
        <div className="p-4 sm:p-8">
          <div className="flex-col items-center">
            <div className="flex flex-col justify-center w-full mb-4 gap-2">
              <div className="join join-horizontal flex justify-center flex-wrap">
                <button
                  className="btn btn-primary join-item"
                  onMouseDown={() => kruskalOneStep()}
                >
                  One Step Kruskal
                </button>
                <button
                  className="btn btn-primary join-item w-36"
                  onClick={kruskalRunning ? kruskalStop : kruskalPlay}
                >
                  {kruskalRunning ? "Stop Kruskal" : "Play Kruskal"}
                </button>
              </div>

              <div className="join join-horizontal flex justify-center flex-wrap">
                <button
                  className="btn btn-primary join-item"
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
                  className="btn btn-primary join-item"
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
                  className="btn btn-primary join-item"
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

          <div className="flex flex-col items-center">
            <div className="flex text-center items-center mt-4 p-2 join join-horizontal">
              <button className="btn btn-primary join-item" onClick={clearMaze}>
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
                className="range range-sm range-primary w-full max-w-xs"
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setRows(value);
                  setCols(value);
                  setKruskalChunkSize(1);
                  setDijkstraChunkSize(1);
                }}
              />
              <span className="text-sm opacity-60 mt-2">
                Maze Size: {rows} x {cols}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
