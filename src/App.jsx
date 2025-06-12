import React from "react";
import { Routes, Route } from "react-router-dom";


import Sidebar from "./components/AppLayout/Sidebar";
import Navbar from "./components/AppLayout/Navbar";
import PageNotFoundPage from "./Pages/PageNotFound";
import HomePage from "./Pages/Home";
import DijkstraPage from "./Pages/PathfindingPages/DijkstraPage";
import KruskalPage from "./Pages/MinimumSpanningTreePages/KruskalPage";
import PrimPage from "./Pages/MinimumSpanningTreePages/PrimPage";

export default function App() {
  return (
    <>
      <div className="drawer lg:drawer-open">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />

        <div className="drawer-content flex flex-col justify-center items-center">
          <Navbar />

          <main className="p-4">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={<PageNotFoundPage />} />

              <Route path="/pathfinding">
                <Route path="dijkstra" element={<DijkstraPage />} />
              </Route>
              <Route path="/minimum-spanning-tree">
                <Route path="kruskal" element={<KruskalPage />} />
                <Route path="prim" element={<PrimPage />} />
              </Route>
            </Routes>
          </main>
        </div>
        <Sidebar />
      </div>
    </>
  );
}
