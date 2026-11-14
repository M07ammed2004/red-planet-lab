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
        target_science: float = 0.0,
        target_storm_hazard: float = 0.0,
    ) -> float:
        """
        Calculate cost for moving into adjacent cell under the selected strategy.
        Fastest: minimizes distance with slight risk and aerodynamic drag penalty.
        Safest: aggressively penalizes terrain risk (slope & roughness) and active dust storm hazards.
        Scientific: attracts route towards high geological value & science targets while avoiding severe storm fronts.
        """
        if strategy == RouteStrategy.FASTEST:
            return step_dist * (1.0 + 0.15 * target_risk + 0.75 * target_storm_hazard)
        elif strategy == RouteStrategy.SAFEST:
            # Quadratic risk scaling heavily detours around hazardous slopes and convective storm cells
            return step_dist * (1.0 + 12.0 * (target_risk ** 2) + 32.0 * (target_storm_hazard ** 2))
        elif strategy == RouteStrategy.SCIENTIFIC_EXPLORATION:
            # Safe navigation prioritizing rich geological features while penalizing storm turbulence
            return step_dist * (1.0 + 2.2 * target_risk + 8.5 * target_storm_hazard) / (1.0 + 3.2 * target_science)
        else:
            return step_dist * (1.0 + 2.0 * target_risk + 6.0 * target_storm_hazard)

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

        has_storm = hasattr(grid, "storm_obstacle_mask") and grid.storm_obstacle_mask is not None
        # Safest and Scientific routes treat severe storm cores as hard impassable obstacles
        treat_storm_as_obstacle = (
            strategy in (RouteStrategy.SAFEST, RouteStrategy.SCIENTIFIC_EXPLORATION) and has_storm
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
                # Hard traversability constraint (slope)
                if not grid.traversable[nr, nc]:
                    continue
                # Hard storm obstacle constraint: detour around storm core
                if treat_storm_as_obstacle and grid.storm_obstacle_mask[nr, nc]:
                    if neighbor != (goal_r, goal_c):
                        continue
                if neighbor in closed_set:
                    continue

                step_dist = self._step_distance(dr, dc, grid.dy_meters, grid.dx_meters)
                target_sci = float(grid.scientific_interest[nr, nc]) if hasattr(grid, "scientific_interest") else 0.0
                target_storm = float(grid.storm_hazard[nr, nc]) if hasattr(grid, "storm_hazard") else 0.0
                edge_cost = self._edge_cost(
                    strategy,
                    step_dist,
                    float(grid.risk[nr, nc]),
                    target_sci,
                    target_storm,
                )
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
        wind_speeds: list[float] = []
        dust_taus: list[float] = []
        storm_hazards: list[float] = []
        scientific_targets_visited: list[str] = []

        cumulative_dist = 0.0
        prev_r, prev_c = path_indices[0]

        for i, (r, c) in enumerate(path_indices):
            lat = float(grid.lats[r])
            lon = float(grid.lons[c])
            elev = float(grid.elevation[r, c])
            slope = float(grid.slope[r, c])
            risk = float(grid.risk[r, c])
            sci = float(grid.scientific_interest[r, c]) if hasattr(grid, "scientific_interest") else 0.0
            w_wind = float(grid.wind_speed[r, c]) if hasattr(grid, "wind_speed") else 0.0
            w_tau = float(grid.dust_tau[r, c]) if hasattr(grid, "dust_tau") else 0.4
            w_storm = float(grid.storm_hazard[r, c]) if hasattr(grid, "storm_hazard") else 0.0

            if i > 0:
                dr = abs(r - prev_r)
                dc = abs(c - prev_c)
                step = self._step_distance(dr, dc, grid.dy_meters, grid.dx_meters)
                cumulative_dist += step / 1000.0  # in km

            # Identify notable science target along path
            target_name = None
            if sci >= 0.70:
                target_name = "Primary Science POI: Layered Lacustrine Stratigraphy"
            elif sci >= 0.50:
                target_name = "Secondary Science Target: Exposed Bedrock Outcrop"
            elif slope >= 8.5:
                target_name = "Geological Contact Scarp"

            if target_name and target_name not in scientific_targets_visited:
                scientific_targets_visited.append(target_name)

            waypoints.append(
                Waypoint(
                    lat=round(lat, 4),
                    lon=round(lon, 4),
                    elevation_m=round(elev, 1),
                    slope_deg=round(slope, 2),
                    risk_score=round(risk, 3),
                    cumulative_distance_km=round(cumulative_dist, 2),
                    scientific_value=round(sci, 3),
                    science_target_name=target_name,
                    wind_speed_ms=round(w_wind, 1),
                    dust_tau=round(w_tau, 2),
                    storm_hazard_level=round(w_storm, 2),
                )
            )
            path_coords.append((round(lat, 4), round(lon, 4)))
            elevation_profile.append(round(elev, 1))
            slopes.append(slope)
            wind_speeds.append(w_wind)
            dust_taus.append(w_tau)
            storm_hazards.append(w_storm)
            prev_r, prev_c = r, c

        elev_change = max(elevation_profile) - min(elevation_profile)
        avg_slope = float(np.mean(slopes)) if slopes else 0.0
        max_slope = float(np.max(slopes)) if slopes else 0.0
        total_sci_roi = round(float(np.sum([wp.scientific_value for wp in waypoints])), 2)

        max_wind = float(np.max(wind_speeds)) if wind_speeds else 0.0
        avg_tau = float(np.mean(dust_taus)) if dust_taus else 0.4
        has_active_storm = hasattr(grid, "storm_obstacle_mask") and np.any(grid.storm_obstacle_mask)
        check_indices = path_indices[1:-1] if len(path_indices) > 2 else path_indices
        entered_storm_core = (
            any(grid.storm_obstacle_mask[r, c] for r, c in check_indices) if has_active_storm else False
        )
        storm_avoided = has_active_storm and not entered_storm_core
        storm_status = (
            "STORM_BYPASSED"
            if storm_avoided
            else ("STORM_PENETRATED" if entered_storm_core else "CLEAR")
        )

        if strategy == RouteStrategy.FASTEST:
            explanation = (
                f"Fastest route minimizes overall Euclidean traverse distance ({cumulative_dist:.2f} km). "
                f"Traverses terrain with an average slope of {avg_slope:.1f}° and a peak slope of {max_slope:.1f}°. "
                f"Total elevation delta across the path is {elev_change:.1f} m."
            )
            if entered_storm_core:
                explanation += f" Note: Traverses dust storm periphery with wind speeds reaching {max_wind:.1f} m/s (dust tau: {avg_tau:.2f})."
        elif strategy == RouteStrategy.SAFEST:
            explanation = (
                f"Safest route prioritizes low-gradient terrain and gentle slopes, navigating {cumulative_dist:.2f} km. "
                f"Maintains an average slope of {avg_slope:.1f}° and caps peak slope at {max_slope:.1f}°."
            )
            if storm_avoided:
                explanation += (
                    f" Active Dust Storm Evaded: Route successfully bypassed the severe storm cell, "
                    f"limiting peak wind shear to {max_wind:.1f} m/s and average dust tau to {avg_tau:.2f}."
                )
            else:
                explanation += " Detours around high-roughness areas to minimize rover hazard."
        elif strategy == RouteStrategy.SCIENTIFIC_EXPLORATION:
            explanation = (
                f"Scientific Exploration corridor maximizes research value (Scientific ROI: {total_sci_roi}) over {cumulative_dist:.2f} km. "
                f"Navigates near {len(scientific_targets_visited)} major geological strata and exposed bedrock contacts, "
                f"maintaining safe traversability with an average slope of {avg_slope:.1f}°."
            )
            if storm_avoided:
                explanation += f" Circumvents active dust storm fronts to protect science optical payload."
        else:
            explanation = (
                f"Exploration route balancing traverse efficiency ({cumulative_dist:.2f} km) with scientific interest."
            )

        limitations = (
            "Regional planning path derived from orbital MOLA topographic grids (~463 m / pixel equivalent) "
            "and in-situ atmospheric microclimate simulations. "
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
            scientific_roi_score=total_sci_roi,
            scientific_targets_visited=scientific_targets_visited,
            max_wind_speed_ms=round(max_wind, 1),
            avg_dust_opacity_tau=round(avg_tau, 2),
            storm_hazard_avoided=storm_avoided,
            storm_status=storm_status,
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
