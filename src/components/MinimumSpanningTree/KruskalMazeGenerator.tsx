import { useRef, useEffect, useState } from "react";

interface cellType {
	status: "blocked" | "passage" | "frontier" | "visited" | "source" | "target" | "shortestPath";
}

function shuffleArray(array: unknown[]): void {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function getVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
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
	const [isMazeComplete, setIsMazeComplete] = useState(false);
	const [dimensions, setDimensions] = useState({
		width: typeof window !== "undefined" ? window.innerWidth : 0,
		height: typeof window !== "undefined" ? window.innerHeight : 0,
	});
	const [drawingMode, setDrawingMode] = useState("");
	const [numGroups, setNumGroups] = useState(0);

	/* ==== REFS ==== */
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cellsRef = useRef<Array<Array<cellType & { groupId?: number }>>>([]);
	const wallsListRef = useRef<Array<{ x: number; y: number }>>([]);
	const distancesRef = useRef<number[][]>([]);
	const visitedRef = useRef<boolean[][]>([]);
	const predecessorsRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
	const dijkstraQueueRef = useRef<Array<{ x: number; y: number; dist: number }>>([]);
	const kruskalRunningRef = useRef(false);
	const dijkstraRunningRef = useRef(false);
	const kruskalChunkSizeRef = useRef(kruskalChunkSize);
	const dijkstraChunkSizeRef = useRef(dijkstraChunkSize);
	const shortestPathAnimatingRef = useRef(false);

	const groupParentsRef = useRef<Map<number, number>>(new Map());
	const groupSizesRef = useRef<Map<number, number>>(new Map());

	/* ==== GRID AND DRAWING LOGIC ==== */
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
	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas === null) return;

		canvas.width = cols;
		canvas.height = rows;

		clearMaze();

		const observer = new MutationObserver(() => {
			cellsRef.current.forEach((row, y) => row.forEach((cell, x) => drawCell(x, y, cell.status)));
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
		if (source !== null && target !== null) {
			dijkstraInitialization();
		}
	}, [source, target]);

	/* ==== KRUSKAL ALGORITHM LOGIC (CORRECTED) ==== */
	function kruskalInitialization(): void {
		const cells = cellsRef.current;
		const walls: Array<{ x: number; y: number }> = [];

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

					if (x < cols - 1) walls.push({ x: x + 1, y });
					if (y < rows - 1) walls.push({ x, y: y + 1 });
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
		const size1 = sizes.get(root1) ?? 1;
		const size2 = sizes.get(root2) ?? 1;

		if (size1 < size2) {
			parents.set(root1, root2);
			sizes.set(root2, size1 + size2);
		} else {
			parents.set(root2, root1);
			sizes.set(root1, size1 + size2);
		}
		setNumGroups((prev) => prev - 1);
	}
	function kruskalOneStep(forceOneStep = false): boolean {
		if (wallsListRef.current.length === 0 || numGroups <= 1) {
			kruskalRunningRef.current = false;
			setKruskalRunning(false);
			setIsMazeComplete(true);
			return true;
		}

		let steps = 0;
		const chunkSize = forceOneStep ? 1 : kruskalChunkSizeRef.current;
		while (steps < chunkSize && wallsListRef.current.length > 0) {
			const wall = wallsListRef.current.pop();
			if (wall === null || wall === undefined) break;

			let cellA, cellB;
			if (wall.x % 2 !== 0) {
				cellA = { x: wall.x - 1, y: wall.y };
				cellB = { x: wall.x + 1, y: wall.y };
			} else {
				cellA = { x: wall.x, y: wall.y - 1 };
				cellB = { x: wall.x, y: wall.y + 1 };
			}

			if (!isInBounds(cellA.x, cellA.y) || !isInBounds(cellB.x, cellB.y)) continue;

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
			setIsMazeComplete(true);
		}
		return done;
	}

	function kruskalPlay(): void {
		if (kruskalRunningRef.current) return;
		kruskalRunningRef.current = true;
		setKruskalRunning(true);
		setIsMazeComplete(false);
		setKruskalChunkSize(Math.floor((cols + rows) / 4));
		kruskalStepLoop();
	}

	function kruskalStop(): void {
		kruskalRunningRef.current = false;
		setKruskalRunning(false);
		setKruskalChunkSize(1);
	}
	function kruskalStepLoop(): void {
		if (!kruskalRunningRef.current) return;
		if (kruskalOneStep(false)) return;
		requestAnimationFrame(kruskalStepLoop);
	}

	/* ==== DIJKSTRA ALGORITHM LOGIC ==== */
	function dijkstraInitialization(): void {
		visitedRef.current.forEach((row, y) => {
			row.forEach((_, x) => {
				visitedRef.current[y][x] = false;
			});
		});
		cellsRef.current.forEach((row, y) => row.forEach((cell, x) => drawCell(x, y, cell.status)));

		const distances = Array(rows)
			.fill(null)
			.map(() => Array(cols).fill(Number.POSITIVE_INFINITY));
		const visited = Array(rows)
			.fill(null)
			.map(() => Array(cols).fill(false));
		const predecessors = Array(rows)
			.fill(null)
			.map(() => Array(cols).fill(null));
		if (source == null || target == null) return;

		distances[source.y][source.x] = 0;
		predecessors[source.y][source.x] = source;
		visitedRef.current = visited;
		predecessorsRef.current = predecessors;
		distancesRef.current = distances;
		dijkstraQueueRef.current = [{ x: source.x, y: source.y, dist: 0 }];
	}
	function dijkstraOneStep(forceOneStep = false): void {
		// If queue is empty but we have source and target, reinitialize
		if (dijkstraQueueRef.current.length === 0 && source !== null && target !== null) {
			dijkstraInitialization();
		}

		const distances = distancesRef.current;
		const visited = visitedRef.current;
		const predecessors = predecessorsRef.current;
		const cells = cellsRef.current;
		const queue = dijkstraQueueRef.current;
		if (source === null || target === null) return;
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
		const chunkSize = forceOneStep ? 1 : dijkstraChunkSizeRef.current;
		while (count++ < chunkSize && queue.length > 0) {
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
					(cells[ny][nx].status === "passage" || cells[ny][nx].status === "target")
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
		predecessors: Array<Array<{ x: number; y: number }>>
	): void {
		const path: Array<{ x: number; y: number }> = [];
		let u: { x: number; y: number } | null = target;
		while (u !== null) {
			path.push(u);
			if (u.x === source.x && u.y === source.y) break;
			u = predecessors[u.y][u.x];
		}
		let i = path.length - 2;
		shortestPathAnimatingRef.current = true;
		function step(): void {
			if (!shortestPathAnimatingRef.current) return;
			if (i < 1) {
				shortestPathAnimatingRef.current = false;
				return;
			}
			const { x, y } = path[i--];
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
		setDijkstraChunkSize(Math.floor((cols + rows) / 16));
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
		dijkstraOneStep(false);
		if (target != null && visitedRef.current[target.y][target.x]) {
			dijkstraRunningRef.current = false;
			setDijkstraRunning(false);
			return;
		}
		requestAnimationFrame(dijkstraStepLoop);
	}

	/* ==== GRID INTERACTION AND CLEARING ==== */
	function handleMouseClick(event: React.MouseEvent<HTMLCanvasElement>): void {
		const canvas = canvasRef.current;
		if (canvas == null || !isMazeComplete) return;

		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;
		const currentCellX = Math.floor(mouseX * scaleX);
		const currentCellY = Math.floor(mouseY * scaleY);

		if (drawingMode === "source" && cellsRef.current[currentCellY][currentCellX].status === "passage") {
			clearDijkstraResults();
			if (source != null) {
				cellsRef.current[source.y][source.x].status = "passage";
				drawCell(source.x, source.y, "passage");
			}
			setSource({ x: currentCellX, y: currentCellY });
			cellsRef.current[currentCellY][currentCellX].status = "source";
			drawCell(currentCellX, currentCellY, "source");
			setDrawingMode("target");
		} else if (drawingMode === "target" && cellsRef.current[currentCellY][currentCellX].status === "passage") {
			clearDijkstraResults();
			if (target != null) {
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
		setIsMazeComplete(false);
		dijkstraRunningRef.current = false;
		kruskalRunningRef.current = false;
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

		const blankGrid: Array<Array<cellType & { groupId?: number }>> = Array.from({ length: rows }, () =>
			Array.from({ length: cols }, () => ({ status: "blocked" }))
		);
		cellsRef.current = blankGrid;
		kruskalInitialization();
	}

	function clearDijkstraResults(): void {
		dijkstraRunningRef.current = false;
		setDijkstraRunning(false);
		setDijkstraPaused(false);
		dijkstraQueueRef.current = [];
		shortestPathAnimatingRef.current = false;
		distancesRef.current = Array(rows)
			.fill(null)
			.map(() => Array(cols).fill(Number.POSITIVE_INFINITY));
		visitedRef.current = Array(rows)
			.fill(null)
			.map(() => Array(cols).fill(false));
		predecessorsRef.current = Array(rows)
			.fill(null)
			.map(() => Array(cols).fill(null));

		cellsRef.current.forEach((row, y) => {
			row.forEach((cell, x) => {
				if (cell.status === "visited" || cell.status === "shortestPath") {
					cell.status = "passage";
					drawCell(x, y, "passage");
				}
			});
		});
		if (source != null) {
			cellsRef.current[source.y][source.x].status = "source";
			drawCell(source.x, source.y, "source");
		}
		if (target != null) {
			cellsRef.current[target.y][target.x].status = "target";
			drawCell(target.x, target.y, "target");
		}
	}

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

	function setHTMLOverlayToCanvas(gridPos: { x: number; y: number }, htmlEl: HTMLElement): void {
		const canvas = canvasRef.current!;
		const container = canvas.parentElement!;

		const canvasRect = canvas.getBoundingClientRect();
		const cellW = canvasRect.width / cols;
		const cellH = canvasRect.height / rows;

		// How far in from the container's padding+border the canvas starts:
		const offsetX = canvas.clientLeft + parseFloat(getComputedStyle(container).paddingLeft);
		const offsetY = canvas.clientTop + parseFloat(getComputedStyle(container).paddingTop);

		// Calculate the position of the HTML element based on the grid position
		const left = offsetX + gridPos.x * cellW + cellW / 2;
		const top = offsetY + gridPos.y * cellH;

		htmlEl.style.left = `${left}px`;
		htmlEl.style.top = `${top}px`;
		htmlEl.style.transform = `translate(-50%, -100%)`;
	}

	useEffect(() => {
		if (source == null) return;
		const sourceElement = document.querySelector<HTMLElement>(".kruskal-source-node");
		if (sourceElement != null) {
			setHTMLOverlayToCanvas(source, sourceElement);
		}
	}, [dimensions, source]);

	useEffect(() => {
		if (target == null) return;
		const targetElement = document.querySelector<HTMLElement>(".kruskal-target-node");
		if (targetElement != null) {
			setHTMLOverlayToCanvas(target, targetElement);
		}
	}, [dimensions, target]);

	function isInBounds(x: number, y: number): boolean {
		return x >= 0 && y >= 0 && x < cols && y < rows;
	}

	return (
		<>
			<div className="p-4 sm:p-8">
				<div className="flex-col items-center">
					<div className="mb-4 flex w-full flex-col justify-center gap-2">
						<div className="join join-horizontal flex flex-wrap justify-center">
							{" "}
							<button
								className="join-item btn btn-primary"
								onMouseDown={() => kruskalOneStep(true)}
							>
								One Step Kruskal
							</button>
							<button
								className="join-item btn btn-primary w-36"
								onClick={kruskalRunning ? kruskalStop : kruskalPlay}
							>
								{kruskalRunning ? "Stop Kruskal" : "Play Kruskal"}
							</button>
						</div>

						<div className="join join-horizontal flex flex-wrap justify-center">
							<button
								className="join-item btn btn-primary"
								onClick={() => setDrawingMode("source")}
								disabled={!isMazeComplete}
							>
								Source
								<svg
									viewBox="0 0 1 1"
									className="ml-2 size-3"
								>
									<rect
										x="0"
										y="0"
										width="1"
										height="1"
										fill={getVar("--color-error")}
										fillOpacity={`${drawingMode === "source" && isMazeComplete ? 1 : 0.25}`}
									/>
								</svg>
							</button>
							<button
								className="join-item btn btn-primary"
								onClick={() => setDrawingMode("target")}
								disabled={!isMazeComplete}
							>
								Target
								<svg
									viewBox="0 0 1 1"
									className="ml-2 size-3"
								>
									<rect
										x="0"
										y="0"
										width="1"
										height="1"
										fill={getVar("--color-success")}
										fillOpacity={`${drawingMode === "target" ? 1 : 0.25}`}
									/>
								</svg>
							</button>{" "}
							<button
								className="join-item btn btn-primary"
								disabled={source === null || target === null}
								onMouseDown={() => dijkstraOneStep(true)}
							>
								One Step Dijkstra
							</button>
							<button
								className="join-item btn btn-primary w-32"
								disabled={source === null || target === null}
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
								className="kruskal-source-node tooltip tooltip-top tooltip-open tooltip-error absolute font-bold opacity-80"
								data-tip="Source Node"
							/>
						)}
						{target !== null && (
							<div
								className="kruskal-target-node tooltip tooltip-top tooltip-open tooltip-success absolute font-bold opacity-80"
								data-tip="Target Node"
							/>
						)}
						<div className="bg-transparent text-center font-bold">
							{!isMazeComplete && !kruskalRunning && (
								<div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-lg bg-base-300/40 px-3 py-1 text-sm shadow-md">
									Click "One Step Kruskal" or "Play Kruskal" to build the maze
								</div>
							)}
							{kruskalRunning && (
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

					<div className="flex flex-col items-center">
						<div className="join join-horizontal mt-4 flex items-center p-2 text-center">
							<button
								className="join-item btn btn-primary"
								onClick={clearMaze}
							>
								Clear All
							</button>
							<button
								className="join-item btn btn-primary"
								disabled={source === null || target === null}
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
									setKruskalChunkSize(1);
									setDijkstraChunkSize(1);
									setSource(null);
									setTarget(null);
									setIsMazeComplete(false);
								}}
							/>
							<span className="mt-2 text-sm opacity-60">
								Maze Size: {rows} x {cols}
							</span>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
