import { useRef, useEffect, useState } from "react";

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cellSize, setCellSize] = useState(100);

  const drawCell = (x: number, y: number, color: string): void => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  };


  function getRandomColor(): string {
    const colors = [
      "orange",
      "red",
      "gray",
      "#B6F500",
      "#37E2D5",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  const hasNeighborRect = (
    row: number,
    col: number,
    grid: boolean[][],
    numRows: number,
    numCols: number
  ): boolean => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const neighborRow = row + dy;
        const neighborCol = col + dx;

        if (
          neighborRow >= 0 &&
          neighborRow < numRows &&
          neighborCol >= 0 &&
          neighborCol < numCols
        ) {
          if (grid[neighborRow][neighborCol]) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const drawRandomRects = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const numCols = Math.ceil(canvas.width / cellSize);
    const numRows = Math.ceil(canvas.height / cellSize);

    const grid: boolean[][] = Array.from({ length: numRows }, () =>
      Array(numCols).fill(false)
    );

    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        if (Math.random() > 0.8) {
          if (!hasNeighborRect(i, j, grid, numRows, numCols)) {
            drawCell(j, i, getRandomColor());
            grid[i][j] = true;
          }
        }
      }
    }
  };

  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      drawRandomRects();
    }

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [cellSize]);

  return (
    <div className="relative min-h-screen">
      {/* Blurred Background */}
      <div className="fixed inset-0 blur-lg" style={{ zIndex: -1 }}>
        <canvas
          className="w-full h-full"
          ref={canvasRef}
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      
      {/* Content Overlay */}
      <div className="relative flex justify-center items-center h-screen">
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl  max-w-3xl flex flex-col items-center shadow-xl border border-gray-300/10 dark:border-gray-600/10 p-6 font-bold">
          <p className="text-xl text-center m-4">
            Welcome to graph algorithms visualizer
          </p>
          


          <p className="text-xl text-center m-4 font-bold">
            Explore various graph algorithms with interactive visualizations.
            More algorithms and features are coming soon!
          </p>
          
        </div>
      </div>
    </div>
  );
}