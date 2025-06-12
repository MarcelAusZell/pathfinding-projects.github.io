import ThemeToggler from "./ThemeToggler";
import { NavLink } from "react-router-dom";

export default function Sidebar(): React.JSX.Element {
  return (
    <>
      <div className="drawer-side font-semibold shadow-md">
        <label htmlFor="my-drawer" className="drawer-overlay"></label>
        <ul className="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "bg-base-content text-base-100" : ""
              }
            >
              Home
            </NavLink>
          </li>
          <li>
            <details open>
              <summary>Pathfinding</summary>
              <ul>
                <li>
                  <NavLink
                    to="/pathfinding/dijkstra"
                    className={({ isActive }) =>
                      isActive ? "bg-base-content text-base-100" : ""
                    }
                  >
                    Dijkstra
                  </NavLink>
                </li>
              </ul>
            </details>
          </li>
          <li>
            <details open>
              <summary>Minimum Spanning Tree</summary>
              <ul>
                <li>
                  <NavLink
                    to="/minimum-spanning-tree/kruskal"
                    className={({ isActive }) =>
                      isActive ? "bg-base-content text-base-100" : ""
                    }
                  >
                    Kruskal
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/minimum-spanning-tree/prim"
                    className={({ isActive }) =>
                      isActive ? "bg-base-content text-base-100" : ""
                    }
                  >
                    Prim
                  </NavLink>
                </li>
              </ul>
            </details>
          </li>
          <div className="flex-1"></div>
          <ThemeToggler></ThemeToggler>
        </ul>
      </div>
    </>
  );
}
