import heapq
import math
import numpy as np
from backend.app.models.route import RouteResult, RouteStrategy, Waypoint
from backend.app.route_planning.traversability import TraversabilityGrid


class AStarPlanner:
    """A* Pathfinding engine for planetary exploration routes."""

    # 8-connected neighborhood: (dr, dc)
    DIRECTIONS = [
        (-1, 0),   # North
        (1, 0),    # South
        (0, -1),   # West
        (0, 1),    # East
        (-1, -1),  # Northwest
        (-1, 1),   # Northeast
        (1, -1),   # Southwest
        (1, 1),    # Southeast
    ]

    def _heuristic(
        self,
        r: int,
        c: int,
        r_goal: int,
        c_goal: int,
        dy: float,
        dx: float,
    ) -> float:
        """Admissible Euclidean metric distance heuristic in meters."""
        return math.sqrt(((r - r_goal) * dy) ** 2 + ((c - c_goal) * dx) ** 2)

    def _step_distance(self, dr: int, dc: int, dy: float, dx: float) -> float:
        """Calculate spatial distance in meters between adjacent grid cells."""
        if dr == 0:
            return dx
        if dc == 0:
            return dy
        return math.sqrt(dy**2 + dx**2)

    def _edge_cost(
        self,
        strategy: RouteStrategy,
        step_dist: float,
        target_risk: float,
    ) -> float:
        """
        Calculate cost for moving into adjacent cell under the selected strategy.
        Formula (AGENT.md Section 9.5):
            Fastest: minimizes distance with slight risk penalty.
            Safest: aggressively penalizes terrain risk (slope & roughness).
        """
        if strategy == RouteStrategy.FASTEST:
            return step_dist * (1.0 + 0.15 * target_risk)
        elif strategy == RouteStrategy.SAFEST:
            # Quadratic risk scaling heavily detours around hazardous slopes
            return step_dist * (1.0 + 12.0 * (target_risk ** 2))
        else:
            return step_dist * (1.0 + 2.0 * target_risk)

    def plan_route(
        self,
        grid: TraversabilityGrid,
        start_idx: tuple[int, int],
        goal_idx: tuple[int, int],
        strategy: RouteStrategy,
    ) -> RouteResult:
        """Execute A* pathfinding on the traversability grid."""
        rows, cols = grid.elevation.shape
        start_r, start_c = start_idx
        goal_r, goal_c = goal_idx

        # Check start and goal feasibility
        if not grid.traversable[start_r, start_c]:
            return self._build_infeasible_result(
                strategy,
                "Start location exceeds maximum traversable slope threshold.",
            )
        if not grid.traversable[goal_r, goal_c]:
            return self._build_infeasible_result(
                strategy,
                "Destination location exceeds maximum traversable slope threshold.",
            )

        # Priority queue stores (f_score, counter, (r, c))
        counter = 0
        open_set: list[tuple[float, int, tuple[int, int]]] = []
        heapq.heappush(open_set, (0.0, counter, (start_r, start_c)))

        came_from: dict[tuple[int, int], tuple[int, int]] = {}
        g_score: dict[tuple[int, int], float] = {(start_r, start_c): 0.0}
        f_score: dict[tuple[int, int], float] = {
            (start_r, start_c): self._heuristic(start_r, start_c, goal_r, goal_c, grid.dy_meters, grid.dx_meters)
        }

        closed_set: set[tuple[int, int]] = set()

        while open_set:
            _, _, current = heapq.heappop(open_set)
            curr_r, curr_c = current

            if current == (goal_r, goal_c):
                # Reconstruct path
                return self._reconstruct_path(
                    grid=grid,
                    came_from=came_from,
                    current=current,
                    strategy=strategy,
                    total_cost=g_score[current],
                )

            closed_set.add(current)

            for dr, dc in self.DIRECTIONS:
                nr, nc = curr_r + dr, curr_c + dc
                neighbor = (nr, nc)

                # Boundary check
                if not (0 <= nr < rows and 0 <= nc < cols):
                    continue
                # Hard traversability constraint
                if not grid.traversable[nr, nc]:
                    continue
                if neighbor in closed_set:
                    continue

                step_dist = self._step_distance(dr, dc, grid.dy_meters, grid.dx_meters)
                edge_cost = self._edge_cost(strategy, step_dist, float(grid.risk[nr, nc]))
                tentative_g = g_score[current] + edge_cost

                if tentative_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    h = self._heuristic(nr, nc, goal_r, goal_c, grid.dy_meters, grid.dx_meters)
                    f_score[neighbor] = tentative_g + h
                    counter += 1
                    heapq.heappush(open_set, (tentative_g + h, counter, neighbor))

        return self._build_infeasible_result(
            strategy,
            "No traversable path exists between the coordinates under the configured slope limits.",
        )

    def _reconstruct_path(
        self,
        grid: TraversabilityGrid,
        came_from: dict[tuple[int, int], tuple[int, int]],
        current: tuple[int, int],
        strategy: RouteStrategy,
        total_cost: float,
    ) -> RouteResult:
        """Reconstruct waypoints, coordinates, elevation profile, and explanatory narrative."""
        path_indices = [current]
        while current in came_from:
            current = came_from[current]
            path_indices.append(current)
        path_indices.reverse()

        waypoints: list[Waypoint] = []
        path_coords: list[tuple[float, float]] = []
        elevation_profile: list[float] = []
        slopes: list[float] = []

        cumulative_dist = 0.0
        prev_r, prev_c = path_indices[0]

        for i, (r, c) in enumerate(path_indices):
            lat = float(grid.lats[r])
            lon = float(grid.lons[c])
            elev = float(grid.elevation[r, c])
            slope = float(grid.slope[r, c])
            risk = float(grid.risk[r, c])

            if i > 0:
                dr = abs(r - prev_r)
                dc = abs(c - prev_c)
                step = self._step_distance(dr, dc, grid.dy_meters, grid.dx_meters)
                cumulative_dist += step / 1000.0  # in km

            waypoints.append(
                Waypoint(
                    lat=round(lat, 4),
                    lon=round(lon, 4),
                    elevation_m=round(elev, 1),
                    slope_deg=round(slope, 2),
                    risk_score=round(risk, 3),
                    cumulative_distance_km=round(cumulative_dist, 2),
                )
            )
            path_coords.append((round(lat, 4), round(lon, 4)))
            elevation_profile.append(round(elev, 1))
            slopes.append(slope)
            prev_r, prev_c = r, c

        elev_change = max(elevation_profile) - min(elevation_profile)
        avg_slope = float(np.mean(slopes)) if slopes else 0.0
        max_slope = float(np.max(slopes)) if slopes else 0.0

        if strategy == RouteStrategy.FASTEST:
            explanation = (
                f"Fastest route minimizes overall Euclidean traverse distance ({cumulative_dist:.2f} km). "
                f"Traverses terrain with an average slope of {avg_slope:.1f}° and a peak slope of {max_slope:.1f}°. "
                f"Total elevation delta across the path is {elev_change:.1f} m."
            )
        elif strategy == RouteStrategy.SAFEST:
            explanation = (
                f"Safest route prioritizes low-gradient terrain and gentle slopes, navigating {cumulative_dist:.2f} km. "
                f"Maintains an average slope of {avg_slope:.1f}° and caps peak slope at {max_slope:.1f}°. "
                f"Detours around high-roughness areas to minimize rover hazard."
            )
        else:
            explanation = (
                f"Exploration route balancing traverse efficiency ({cumulative_dist:.2f} km) with scientific interest."
            )

        limitations = (
            "Regional planning path derived from orbital MOLA topographic grids (~463 m / pixel equivalent). "
            "Does not detect sub-pixel boulders, sand ripples, or localized escarpments. "
            "Rover ground operations require in-situ hazard detection."
        )

        return RouteResult(
            strategy=strategy,
            feasible=True,
            total_distance_km=round(cumulative_dist, 2),
            total_cost=round(total_cost, 2),
            avg_slope_deg=round(avg_slope, 2),
            max_slope_deg=round(max_slope, 2),
            elevation_change_m=round(elev_change, 1),
            elevation_profile=elevation_profile,
            path_coords=path_coords,
            waypoints=waypoints,
            explanation=explanation,
            limitations_note=limitations,
        )

    def _build_infeasible_result(self, strategy: RouteStrategy, reason: str) -> RouteResult:
        """Return an explicit infeasible result object without failing abruptly."""
        return RouteResult(
            strategy=strategy,
            feasible=False,
            total_distance_km=0.0,
            total_cost=float("inf"),
            avg_slope_deg=0.0,
            max_slope_deg=0.0,
            elevation_change_m=0.0,
            elevation_profile=[],
            path_coords=[],
            waypoints=[],
            explanation=f"Route planning infeasible: {reason}",
            limitations_note="Path terminated by hard terrain constraints.",
        )
