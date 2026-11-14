import math
import numpy as np
from backend.app.models.weather import (
    SectorWeatherCondition,
    StormCell,
    StormSeverity,
    WindVector,
)


class AtmosphericService:
    """Simulates realistic Martian atmospheric, meteorological, and storm conditions."""

    # In-memory storage for active sector weather simulations
    _sector_conditions: dict[str, SectorWeatherCondition] = {}

    def get_sector_weather(self, sector_id: str) -> SectorWeatherCondition:
        """Retrieve current atmospheric and storm conditions for a sector."""
        if sector_id in self._sector_conditions:
            return self._sector_conditions[sector_id]

        # Generate realistic default baseline condition based on actual lander records
        sec_upper = sector_id.upper()
        if "JEZERO" in sec_upper:
            # Calibrated against Perseverance MEDA sensors
            cond = SectorWeatherCondition(
                sector_id=sector_id,
                sol=1042,
                local_mars_time="14:28:10 LMST",
                solar_longitude_ls=145.2,
                air_temperature_c=-52.4,
                ground_temperature_c=-14.8,
                atmospheric_pressure_pa=742.0,
                dust_optical_depth_tau=0.38,
                prevailing_wind=WindVector(
                    speed_ms=7.8,
                    direction_deg=315.0,  # NW prevailing winds
                    gust_ms=12.4,
                    u_component=round(-7.8 * math.sin(math.radians(315)), 2),
                    v_component=round(-7.8 * math.cos(math.radians(315)), 2),
                ),
                storm_severity=StormSeverity.CALM,
                active_storms=[],
                atmospheric_density_kg_m3=0.0152,
                sensor_station_name="Perseverance MEDA Weather Station (Jezero Crater)",
            )
        elif "GALE" in sec_upper:
            # Calibrated against Curiosity REMS sensors
            cond = SectorWeatherCondition(
                sector_id=sector_id,
                sol=4120,
                local_mars_time="11:45:00 LMST",
                solar_longitude_ls=145.2,
                air_temperature_c=-61.2,
                ground_temperature_c=-18.5,
                atmospheric_pressure_pa=815.0,
                dust_optical_depth_tau=0.44,
                prevailing_wind=WindVector(
                    speed_ms=5.4,
                    direction_deg=220.0,
                    gust_ms=8.9,
                    u_component=round(-5.4 * math.sin(math.radians(220)), 2),
                    v_component=round(-5.4 * math.cos(math.radians(220)), 2),
                ),
                storm_severity=StormSeverity.CALM,
                active_storms=[],
                atmospheric_density_kg_m3=0.0165,
                sensor_station_name="Curiosity REMS Station (Mount Sharp Foothills)",
            )
        else:
            cond = SectorWeatherCondition(
                sector_id=sector_id,
                sol=850,
                local_mars_time="13:00:00 LMST",
                solar_longitude_ls=145.2,
                air_temperature_c=-68.0,
                ground_temperature_c=-24.0,
                atmospheric_pressure_pa=620.0,
                dust_optical_depth_tau=0.40,
                prevailing_wind=WindVector(
                    speed_ms=9.2,
                    direction_deg=270.0,
                    gust_ms=14.5,
                    u_component=-9.2,
                    v_component=0.0,
                ),
                storm_severity=StormSeverity.CALM,
                active_storms=[],
                atmospheric_density_kg_m3=0.0125,
                sensor_station_name="Viking / MGS Regional Climate Observation Datum",
            )

        self._sector_conditions[sector_id] = cond
        return cond

    def configure_storm(
        self,
        sector_id: str,
        severity: StormSeverity,
        center_lat: float | None = None,
        center_lon: float | None = None,
        radius_km: float | None = None,
    ) -> SectorWeatherCondition:
        """Inject or configure an active dust storm scenario in the sector."""
        base = self.get_sector_weather(sector_id)
        sec_upper = sector_id.upper()

        if severity == StormSeverity.CALM:
            base.storm_severity = StormSeverity.CALM
            base.active_storms = []
            base.dust_optical_depth_tau = 0.38
            self._sector_conditions[sector_id] = base
            return base

        # Determine realistic default coordinates for active storm cells
        # Positioned along the transit zone to test dynamic obstacle avoidance
        if center_lat is None or center_lon is None:
            if "JEZERO" in sec_upper:
                # Placed in the central corridor between landing site and western rim delta
                c_lat, c_lon = 18.468, 77.408
                def_radius = 4.2
            elif "GALE" in sec_upper:
                c_lat, c_lon = -4.685, 137.410
                def_radius = 3.8
            else:
                c_lat, c_lon = 18.50, 226.15
                def_radius = 8.0
        else:
            c_lat, c_lon = center_lat, center_lon
            def_radius = radius_km if radius_km is not None else 4.2

        if radius_km is not None:
            def_radius = radius_km

        if severity == StormSeverity.MODERATE_DUST:
            max_wind = 22.5
            tau = 2.4
            name = "Regional Convective Dust Plume"
        elif severity == StormSeverity.SEVERE_STORM:
            max_wind = 29.8
            tau = 3.8
            name = "Severe Jezero Sol-Frontal Dust Storm"
        else:  # GLOBAL_EVENT
            max_wind = 36.0
            tau = 5.2
            name = "Planet-Encircling Global Dust Event Front"

        storm_cell = StormCell(
            cell_id=f"STORM-{sector_id[:6]}-01",
            name=name,
            center_lat=c_lat,
            center_lon=c_lon,
            radius_km=def_radius,
            severity=severity,
            max_wind_speed_ms=max_wind,
            optical_depth_tau=tau,
            dust_density_g_m3=0.012 if severity != StormSeverity.GLOBAL_EVENT else 0.045,
            is_active=True,
        )

        base.storm_severity = severity
        base.active_storms = [storm_cell]
        base.dust_optical_depth_tau = tau
        base.prevailing_wind.speed_ms = round(max_wind * 0.75, 1)
        base.prevailing_wind.gust_ms = round(max_wind * 1.15, 1)

        self._sector_conditions[sector_id] = base
        return base

    def compute_atmospheric_grids(
        self,
        sector_id: str,
        lats: np.ndarray,
        lons: np.ndarray,
        elevation: np.ndarray,
        slope: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Compute 2D atmospheric hazard matrices across the sector grid:
        Returns:
            wind_speed: np.ndarray (m/s)
            dust_tau: np.ndarray (optical depth)
            storm_hazard: np.ndarray (normalized [0, 1])
            storm_obstacle_mask: np.ndarray (bool mask of impassable storm cells)
        """
        weather = self.get_sector_weather(sector_id)
        rows, cols = elevation.shape

        base_wind = weather.prevailing_wind.speed_ms
        base_tau = weather.dust_optical_depth_tau

        # 1. Base wind modulated by slope katabatic flow (winds accelerate down slopes)
        slope_accel = np.clip(slope / 20.0, 0.0, 1.0) * 4.5
        wind_grid = np.full((rows, cols), base_wind, dtype=np.float32) + slope_accel
        tau_grid = np.full((rows, cols), base_tau, dtype=np.float32)

        storm_hazard = np.zeros((rows, cols), dtype=np.float32)
        storm_obstacle_mask = np.zeros((rows, cols), dtype=bool)

        if not weather.active_storms:
            # Baseline mild wind hazard
            wind_norm = np.clip((wind_grid - 5.0) / 25.0, 0.0, 1.0)
            tau_norm = np.clip((tau_grid - 0.2) / 2.0, 0.0, 1.0)
            storm_hazard = 0.6 * wind_norm + 0.4 * tau_norm
            return wind_grid, tau_grid, storm_hazard, storm_obstacle_mask

        # 2. Overlay Gaussian vortex profiles for active storm cells
        MARS_KM_PER_DEG = 59.27  # approximate km per degree on Mars equator
        mean_lat = float(np.mean(lats))
        km_per_deg_lon = MARS_KM_PER_DEG * math.cos(math.radians(mean_lat))

        for storm in weather.active_storms:
            if not storm.is_active:
                continue

            # Calculate physical distance (km) from each grid cell to storm center
            # lats is 1D (rows), lons is 1D (cols)
            d_lat_km = (lats[:, None] - storm.center_lat) * MARS_KM_PER_DEG
            d_lon_km = (lons[None, :] - storm.center_lon) * km_per_deg_lon
            dist_km = np.sqrt(d_lat_km ** 2 + d_lon_km ** 2)

            # Storm intensity profile (Gaussian plume falling off beyond radius)
            sigma = max(storm.radius_km * 0.65, 1.0)
            influence = np.exp(-0.5 * (dist_km / sigma) ** 2)

            # Additional wind velocity and dust optical depth within the storm plume
            storm_wind_boost = storm.max_wind_speed_ms * influence
            storm_tau_boost = (storm.optical_depth_tau - base_tau) * influence

            wind_grid = np.maximum(wind_grid, storm_wind_boost)
            tau_grid += storm_tau_boost

            # Storm hazard index: combines high wind velocity and heavy dust obscuration
            cell_hazard = np.clip(
                0.55 * (wind_grid / 30.0) + 0.45 * (tau_grid / 4.0), 0.0, 1.0
            )
            storm_hazard = np.maximum(storm_hazard, cell_hazard)

            # Hard obstacle condition: storm eye and core where dust density or wind is fatal to rovers
            is_core = (dist_km <= (storm.radius_km * 0.55)) & (tau_grid >= 2.0)
            if storm.severity in (StormSeverity.SEVERE_STORM, StormSeverity.GLOBAL_EVENT):
                is_core = is_core | (dist_km <= (storm.radius_km * 0.65))

            storm_obstacle_mask = storm_obstacle_mask | is_core

        return wind_grid, tau_grid, storm_hazard, storm_obstacle_mask


atmospheric_service = AtmosphericService()
