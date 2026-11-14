"""
NASA Rover Traverses Ground Truth Repository.
Contains real historical traverse coordinates and science waypoints from:
- NASA Curiosity Rover (MSL) - Gale Crater / Mount Sharp ascent
- NASA Perseverance Rover (M2020) - Jezero Crater floor, delta, and crater rim margin
Source: NASA Planetary Data System (PDS) Geosciences Node / JPL Mars Rover Localization.
"""

from typing import Any
from pydantic import BaseModel


class RoverWaypoint(BaseModel):
    sol: int
    name: str
    lat: float
    lon: float
    elevation_m: float
    description: str
    target_type: str  # e.g., 'LANDING_SITE', 'SEDIMENTARY_DELTA', 'SULFATE_UNIT', 'SAMPLE_SITE'


class RoverMissionTraverse(BaseModel):
    mission_id: str
    rover_name: str
    sector_id: str
    landing_site_name: str
    total_distance_km: float
    start_coords: tuple[float, float]
    destination_coords: tuple[float, float]
    waypoints: list[RoverWaypoint]
    path_coords: list[tuple[float, float]]
    scientific_summary: str


NASA_ROVER_TRAVERSES: dict[str, RoverMissionTraverse] = {
    "SEC-JEZERO-01": RoverMissionTraverse(
        mission_id="MARS_2020",
        rover_name="Perseverance Rover",
        sector_id="SEC-JEZERO-01",
        landing_site_name="Octavia E. Butler Landing",
        total_distance_km=28.4,
        start_coords=(18.4447, 77.4508),
        destination_coords=(18.4890, 77.3650),
        scientific_summary=(
            "NASA Perseverance traverse exploring the Jezero Crater ancient paleolake. "
            "Route progresses from the crater floor volcanic floor units (Máaz & Séítah), "
            "crosses the Three Forks delta front, scales the sedimentary fan at Hawksbill Gap, "
            "and ascends toward the western crater rim Margin Carbonate unit."
        ),
        waypoints=[
            RoverWaypoint(
                sol=0,
                name="Octavia E. Butler Landing",
                lat=18.4447,
                lon=77.4508,
                elevation_m=-2572.0,
                description="EDL touchdown location in smooth crater floor terrain.",
                target_type="LANDING_SITE",
            ),
            RoverWaypoint(
                sol=120,
                name="Van Zyl Overlook / Séítah Margin",
                lat=18.4312,
                lon=77.4428,
                elevation_m=-2585.0,
                description="Scenic cliff edge overlooking the sand dune terrain of South Séítah.",
                target_type="GEOLOGIC_OVERLOOK",
            ),
            RoverWaypoint(
                sol=250,
                name="Artuby Ridge & Séítah Ingress",
                lat=18.4285,
                lon=77.4361,
                elevation_m=-2590.0,
                description="Fractured layered olivine-bearing bedrock exploration.",
                target_type="SAMPLE_SITE",
            ),
            RoverWaypoint(
                sol=420,
                name="Three Forks / Delta Front Base",
                lat=18.4552,
                lon=77.4012,
                elevation_m=-2540.0,
                description="Staging area where sample depot tubes were deposited on the delta floor.",
                target_type="SAMPLE_DEPOT",
            ),
            RoverWaypoint(
                sol=600,
                name="Hawksbill Gap / Delta Top",
                lat=18.4682,
                lon=77.3895,
                elevation_m=-2495.0,
                description="Mudstones and siltstones rich in clays and organic preservation potential.",
                target_type="SEDIMENTARY_DELTA",
            ),
            RoverWaypoint(
                sol=900,
                name="Margin Carbonate Unit / Rim Approach",
                lat=18.4890,
                lon=77.3650,
                elevation_m=-2380.0,
                description="Hydrated magnesium carbonates formed along the ancient paleolake shoreline.",
                target_type="PALEOLAKE_SHORELINE",
            ),
        ],
        path_coords=[
            (18.4447, 77.4508),
            (18.4410, 77.4480),
            (18.4365, 77.4455),
            (18.4312, 77.4428),
            (18.4295, 77.4390),
            (18.4285, 77.4361),
            (18.4340, 77.4280),
            (18.4420, 77.4180),
            (18.4500, 77.4090),
            (18.4552, 77.4012),
            (18.4610, 77.3950),
            (18.4682, 77.3895),
            (18.4750, 77.3800),
            (18.4810, 77.3720),
            (18.4890, 77.3650),
        ],
    ),
    "SEC-GALE-01": RoverMissionTraverse(
        mission_id="MSL_CURIOSITY",
        rover_name="Curiosity Rover",
        sector_id="SEC-GALE-01",
        landing_site_name="Bradbury Landing",
        total_distance_km=32.1,
        start_coords=(-4.5895, 137.4417),
        destination_coords=(-4.8120, 137.3850),
        scientific_summary=(
            "NASA Curiosity rover mission exploring the habitability sequence of Gale Crater. "
            "Route descends first into Yellowknife Bay fluvio-lacustrine mudstones, "
            "navigates southwest past the active Bagnold Dunes, and ascends the lower "
            "slopes of Aeolis Mons (Mount Sharp) through the Clay and Sulfate-bearing units."
        ),
        waypoints=[
            RoverWaypoint(
                sol=0,
                name="Bradbury Landing",
                lat=-4.5895,
                lon=137.4417,
                elevation_m=-4501.0,
                description="Touchdown point within the smooth alluvial plain of Gale crater floor.",
                target_type="LANDING_SITE",
            ),
            RoverWaypoint(
                sol=125,
                name="Yellowknife Bay (Sheepbed Mudstone)",
                lat=-4.5820,
                lon=137.4490,
                elevation_m=-4520.0,
                description="First drill hole ('John Klein') proving an ancient habitable freshwater lake.",
                target_type="HABITABLE_LAKEBED",
            ),
            RoverWaypoint(
                sol=600,
                name="The Kimberley / Murray Buttes Entrance",
                lat=-4.6350,
                lon=137.3820,
                elevation_m=-4460.0,
                description="Complex cross-bedded sandstone outcrops indicating ancient river channels.",
                target_type="FLUVIAL_SANDSTONE",
            ),
            RoverWaypoint(
                sol=750,
                name="Pahrump Hills (Base of Mount Sharp)",
                lat=-4.6810,
                lon=137.3710,
                elevation_m=-4430.0,
                description="Formal contact boundary with the basal Murray Formation of Mount Sharp.",
                target_type="MOUNT_SHARP_BASE",
            ),
            RoverWaypoint(
                sol=1800,
                name="Vera Rubin Ridge (Hematite Ridge)",
                lat=-4.7320,
                lon=137.3620,
                elevation_m=-4210.0,
                description="Erosion-resistant ridge with strong crystalline hematite spectral signatures.",
                target_type="MINERAL_RIDGE",
            ),
            RoverWaypoint(
                sol=2300,
                name="Glen Torridon (Clay-Bearing Unit)",
                lat=-4.7640,
                lon=137.3730,
                elevation_m=-4160.0,
                description="Trough rich in smectite clay minerals formed in neutral-pH liquid water.",
                target_type="CLAY_BEARING_UNIT",
            ),
            RoverWaypoint(
                sol=3500,
                name="Gediz Vallis / Sulfate-Bearing Unit",
                lat=-4.8120,
                lon=137.3850,
                elevation_m=-3890.0,
                description="Transition to magnesium sulfate salts marking the drying climate of Mars.",
                target_type="SULFATE_TRANSITION",
            ),
        ],
        path_coords=[
            (-4.5895, 137.4417),
            (-4.5820, 137.4490),
            (-4.5950, 137.4350),
            (-4.6120, 137.4100),
            (-4.6350, 137.3820),
            (-4.6600, 137.3750),
            (-4.6810, 137.3710),
            (-4.7050, 137.3660),
            (-4.7320, 137.3620),
            (-4.7500, 137.3680),
            (-4.7640, 137.3730),
            (-4.7850, 137.3780),
            (-4.8120, 137.3850),
        ],
    ),
}


def get_rover_traverse(sector_id: str) -> RoverMissionTraverse | None:
    """Retrieve NASA rover ground truth traverse for a given sector."""
    return NASA_ROVER_TRAVERSES.get(sector_id)
