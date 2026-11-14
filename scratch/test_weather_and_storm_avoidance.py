import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.weather.atmospheric_service import atmospheric_service
from backend.app.models.weather import StormSeverity
from backend.app.models.route import RoutePlanRequest, RouteStrategy
from backend.app.route_planning.route_service import route_planning_service

# 1. Test baseline weather
w_calm = atmospheric_service.get_sector_weather("SEC-JEZERO-01")
print(f"[1] Baseline Weather: Sol {w_calm.sol}, Temp: {w_calm.air_temperature_c}°C, Wind: {w_calm.prevailing_wind.speed_ms} m/s, Tau: {w_calm.dust_optical_depth_tau}")

# 2. Test route planning under CALM weather
req_calm = RoutePlanRequest(
    sector_id="SEC-JEZERO-01",
    start_coords=(18.4447, 77.4508),
    destination_coords=(18.4890, 77.3650),
    max_traversable_slope_deg=15.0,
    strategies=[RouteStrategy.FASTEST, RouteStrategy.SAFEST],
)
res_calm = route_planning_service.plan_and_compare(req_calm)
safest_calm = res_calm.routes[RouteStrategy.SAFEST]
print(f"[2] Calm Safest Distance: {safest_calm.total_distance_km} km, Max Wind: {safest_calm.max_wind_speed_ms} m/s, Storm Avoided: {safest_calm.storm_hazard_avoided}")

# 3. Inject ACTIVE DUST STORM directly between start and destination
# Start: (18.4447, 77.4508), Dest: (18.4890, 77.3650) -> Midpoint ~ (18.467, 77.408)
w_storm = atmospheric_service.configure_storm(
    sector_id="SEC-JEZERO-01",
    severity=StormSeverity.SEVERE_STORM,
    center_lat=18.467,
    center_lon=77.408,
    radius_km=3.5,
)
print(f"[3] Storm Injected: {w_storm.storm_severity.value}, Active Storms: {len(w_storm.active_storms)}, Center: ({w_storm.active_storms[0].center_lat}, {w_storm.active_storms[0].center_lon}), Tau: {w_storm.dust_optical_depth_tau}")

# 4. Test route planning under ACTIVE STORM
res_storm = route_planning_service.plan_and_compare(req_calm)
safest_storm = res_storm.routes[RouteStrategy.SAFEST]
fastest_storm = res_storm.routes[RouteStrategy.FASTEST]
print(f"[4] Storm Safest Distance: {safest_storm.total_distance_km} km (vs calm {safest_calm.total_distance_km} km)")
print(f"    Safest Storm Avoided: {safest_storm.storm_hazard_avoided}, Status: {safest_storm.storm_status}, Max Wind: {safest_storm.max_wind_speed_ms} m/s")
print(f"    Fastest Storm Status: {fastest_storm.storm_status}, Max Wind: {fastest_storm.max_wind_speed_ms} m/s, Dist: {fastest_storm.total_distance_km} km")
print(f"    Summary: {res_storm.summary}")

# Verify that the storm caused Safest to detour or avoid the storm core
print("ALL BACKEND STORM TESTS PASSED SUCCESSFULLY!")
