import urllib.request
import json

def test_route(sector, start, dest, max_slope):
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/routes/plan',
        data=json.dumps({
            'sector_id': sector,
            'start_coords': start,
            'destination_coords': dest,
            'max_traversable_slope_deg': max_slope,
            'strategies': ['FASTEST', 'SAFEST', 'SCIENTIFIC_EXPLORATION']
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"=== Sector: {sector} ===")
        for s, r in data['routes'].items():
            roi = r.get('scientific_roi_score')
            targets = r.get('scientific_targets_visited')
            print(f"  [{s}] Feasible: {r['feasible']}, Dist: {r['total_distance_km']}km, AvgSlope: {r['avg_slope_deg']}°, MaxSlope: {r['max_slope_deg']}°, ROI: {roi}, Targets: {targets}")
        print("  Summary:", data['summary'])

test_route('SEC-JEZERO-01', [18.38, 77.40], [18.52, 77.55], 16.0)
test_route('SEC-GALE-01', [-4.65, 137.35], [-4.78, 137.45], 18.0)
