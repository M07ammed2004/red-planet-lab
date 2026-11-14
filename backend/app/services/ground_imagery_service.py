"""
Service providing in-situ surface photographs captured by NASA rovers
(Perseverance Mastcam-Z/Navcam and Curiosity Mastcam) tied to geographic coordinates.
Source: NASA Mars 2020 & MSL Raw Image Galleries.
"""

from typing import Any
from pydantic import BaseModel


class SurfacePhoto(BaseModel):
    photo_id: str
    mission: str
    rover_name: str
    instrument: str
    sol: int
    earth_date: str
    lat: float
    lon: float
    target_name: str
    image_url: str
    caption: str
    filter_or_camera: str


class GroundImageryService:
    """Manages rover surface photographs georeferenced to sector coordinates."""

    SURFACE_PHOTOS: dict[str, list[SurfacePhoto]] = {
        "SEC-JEZERO-01": [
            SurfacePhoto(
                photo_id="M2020-SOL003-MASTCAMZ-01",
                mission="Mars 2020",
                rover_name="Perseverance",
                instrument="Mastcam-Z",
                sol=3,
                earth_date="2021-02-21",
                lat=18.4447,
                lon=77.4508,
                target_name="Jezero Crater Floor First 360 Panorama",
                image_url="/images/rover/PIA24482.jpg",
                caption="High-resolution color 360-degree panorama of the Jezero Crater floor taken from Octavia E. Butler landing site.",
                filter_or_camera="Right Eye / RGB Filter",
            ),
            SurfacePhoto(
                photo_id="M2020-SOL180-SEITAH-02",
                mission="Mars 2020",
                rover_name="Perseverance",
                instrument="SuperCam Remote Micro-Imager",
                sol=180,
                earth_date="2021-08-22",
                lat=18.4312,
                lon=77.4428,
                target_name="Séítah Sand Dunes & Layered Rock",
                image_url="/images/rover/PIA24748.jpg",
                caption="Eolian ripples and layered bedrock exposures across the South Séítah geologic unit.",
                filter_or_camera="SuperCam RMI Telephoto",
            ),
            SurfacePhoto(
                photo_id="M2020-SOL420-DELTA-03",
                mission="Mars 2020",
                rover_name="Perseverance",
                instrument="Mastcam-Z",
                sol=420,
                earth_date="2022-04-26",
                lat=18.4552,
                lon=77.4012,
                target_name="Three Forks Ancient Delta Scarp",
                image_url="/images/rover/PIA25176.jpg",
                caption="Prominent river delta front scarp showing sedimentary bedding deposited billions of years ago in a lake.",
                filter_or_camera="Mastcam-Z 110mm Zoom",
            ),
            SurfacePhoto(
                photo_id="M2020-SOL610-KODIAK-04",
                mission="Mars 2020",
                rover_name="Perseverance",
                instrument="Mastcam-Z",
                sol=610,
                earth_date="2022-11-06",
                lat=18.4682,
                lon=77.3895,
                target_name="Kodiak Butte Sedimentary Foreset Beds",
                image_url="/images/rover/PIA24838.jpg",
                caption="Steeply dipping foreset beds at Kodiak butte confirming delta formation in a standing body of water.",
                filter_or_camera="Left Eye / High-Gain Stereo",
            ),
        ],
        "SEC-GALE-01": [
            SurfacePhoto(
                photo_id="MSL-SOL125-YELLOWKNIFE-01",
                mission="Mars Science Laboratory",
                rover_name="Curiosity",
                instrument="Mastcam-100",
                sol=125,
                earth_date="2012-12-12",
                lat=-4.5820,
                lon=137.4490,
                target_name="Sheepbed Mudstone Drill Hole",
                image_url="/images/rover/PIA16790.jpg",
                caption="Powdered rock tailings from the first drill hole in ancient lakebed mudstone showing grey, unoxidized clay minerals.",
                filter_or_camera="Mastcam 100mm Telephoto",
            ),
            SurfacePhoto(
                photo_id="MSL-SOL1800-VERA-RUBIN-02",
                mission="Mars Science Laboratory",
                rover_name="Curiosity",
                instrument="Mastcam-34",
                sol=1800,
                earth_date="2017-08-30",
                lat=-4.7320,
                lon=137.3620,
                target_name="Vera Rubin Ridge Crest Overlook",
                image_url="/images/rover/PIA16225.jpg",
                caption="Hematite-bearing ridge overlooking the vast Gale crater floor and Mount Sharp's central peak.",
                filter_or_camera="Mastcam 34mm Wide Angle",
            ),
            SurfacePhoto(
                photo_id="MSL-SOL2300-GLEN-TORRIDON-03",
                mission="Mars Science Laboratory",
                rover_name="Curiosity",
                instrument="Navcam",
                sol=2300,
                earth_date="2019-02-10",
                lat=-4.7640,
                lon=137.3730,
                target_name="Glen Torridon Clay Trough",
                image_url="/images/rover/PIA16051.jpg",
                caption="Clay-bearing trough with laminated bedrock representing prolonged watery deposition in Gale Crater.",
                filter_or_camera="Navcam Stereo Pair",
            ),
            SurfacePhoto(
                photo_id="MSL-SOL3500-GEDIZ-VALLIS-04",
                mission="Mars Science Laboratory",
                rover_name="Curiosity",
                instrument="Mastcam-100",
                sol=3500,
                earth_date="2022-06-25",
                lat=-4.8120,
                lon=137.3850,
                target_name="Gediz Vallis Debris Channel",
                image_url="/images/rover/PIA19839.jpg",
                caption="Massive canyon carved into Mount Sharp by late-stage catastrophic water debris flows.",
                filter_or_camera="Mastcam 100mm Telephoto",
            ),
        ],
    }

    def get_photos_for_sector(self, sector_id: str) -> list[SurfacePhoto]:
        """Return georeferenced surface photo pins for a sector."""
        return self.SURFACE_PHOTOS.get(sector_id, [])


ground_imagery_service = GroundImageryService()
