#!/usr/bin/env python3
"""
Waterloo Campus Pathfinder Backend
Finds shortest paths between buildings using Dijkstra's algorithm
"""

import json
import math
from datetime import datetime, date
from pathlib import Path

import heapq
from typing import Dict, List, Tuple, Optional
from flask import Flask, jsonify, request
from flask_cors import CORS

from schedule_importer import (
    parse_schedule_text,
    save_schedule_entries,
    load_schedule_entries,
    persist_raw_schedule,
)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

BASE_DIR = Path(__file__).resolve().parent

# Load data at startup
with open(BASE_DIR / 'geoJson' / 'buildings.json', 'r') as f:
    buildings_json = json.load(f)

with open(BASE_DIR / 'geoJson' / 'paths.json', 'r') as f:
    paths_json = json.load(f)

def haversine(a: Dict, b: Dict) -> float:
    """Calculate accurate distance between two points on a sphere (in meters)"""
    R = 6371e3  # Earth radius in meters
    to_rad = lambda x: x * math.pi / 180
    
    d_lat = to_rad(b['lat'] - a['lat'])
    d_lng = to_rad(b['lng'] - a['lng'])
    lat1 = to_rad(a['lat'])
    lat2 = to_rad(b['lat'])
    
    h = (math.sin(d_lat/2)**2 + 
         math.cos(lat1) * math.cos(lat2) * math.sin(d_lng/2)**2)
    return 2 * R * math.asin(math.sqrt(h))

def build_graph(paths_geojson: Dict) -> Tuple[Dict, List, Dict]:
    """Build graph from GeoJSON path data"""
    nodes = {}  # key -> {id, lat, lng}
    nodes_by_id = []
    edges = {}  # id -> [{to, weight}, ...]
    node_id = 0
    
    def ensure_node(lng: float, lat: float) -> int:
        nonlocal node_id
        key = f"{lng},{lat}"
        if key in nodes:
            return nodes[key]['id']
        
        nid = node_id
        node_id += 1
        nodes[key] = {'id': nid, 'lat': lat, 'lng': lng}
        nodes_by_id.append(nodes[key])
        edges[nid] = []
        return nid
    
    for feature in paths_geojson.get('features', []):
        geom = feature.get('geometry')
        if not geom:
            continue
            
        if geom.get('type') == 'LineString' and isinstance(geom.get('coordinates'), list):
            coords = geom['coordinates']
            for i in range(len(coords) - 1):
                lng1, lat1 = coords[i]
                lng2, lat2 = coords[i + 1]
                
                a = ensure_node(lng1, lat1)
                b = ensure_node(lng2, lat2)
                
                weight = haversine(nodes_by_id[a], nodes_by_id[b])
                edges[a].append({'to': b, 'weight': weight})
                edges[b].append({'to': a, 'weight': weight})
    
    return nodes, nodes_by_id, edges

def nearest_node(nodes_by_id: List, lng: float, lat: float) -> Optional[int]:
    """Find the nearest graph node to a given coordinate"""
    best = None
    best_dist = float('inf')
    
    for node in nodes_by_id:
        if not node:
            continue
        d = haversine(node, {'lat': lat, 'lng': lng})
        if d < best_dist:
            best_dist = d
            best = node['id']
    
    return best

def dijkstra(edges: Dict, start_id: int) -> Tuple[Dict, Dict]:
    """Run Dijkstra's algorithm from start node"""
    dist = {k: float('inf') for k in edges.keys()}
    prev = {}
    dist[start_id] = 0
    
    pq = [(0, start_id)]
    visited = set()
    
    while pq:
        current_dist, node = heapq.heappop(pq)
        
        if node in visited:
            continue
        visited.add(node)
        
        for edge in edges[node]:
            alt = dist[node] + edge['weight']
            if alt < dist[edge['to']]:
                dist[edge['to']] = alt
                prev[edge['to']] = node
                heapq.heappush(pq, (alt, edge['to']))
    
    return dist, prev

def reconstruct_path(prev: Dict, end_id: int) -> List[int]:
    """Reconstruct path from start to end using prev pointers"""
    path = []
    current = end_id
    
    while current is not None:
        path.append(current)
        current = prev.get(current)
    
    return list(reversed(path))

def format_distance(meters: float) -> str:
    """Format distance in meters or kilometers"""
    if meters >= 1000:
        return f"{meters/1000:.2f} km"
    return f"{int(round(meters))} m"
def extract_building(room: Optional[str]) -> str:
    return room.split()[0] if room else "UNKNOWN"


def weekday_letter(date_obj: date) -> str:
    mapping = {
        0: "M",
        1: "T",
        2: "W",
        3: "Th",
        4: "F",
        5: "Sa",
        6: "Su"
    }
    return mapping[date_obj.weekday()]



# Build building map
building_map = {}
for feature in buildings_json.get('features', []):
    props = feature.get('properties', {})
    building = props.get('building', {})
    code = building.get('buildingCode')
    geom = feature.get('geometry')
    
    if code and geom and geom.get('coordinates'):
        # Store first occurrence only
        if code not in building_map:
            building_map[code] = {
                'lng': geom['coordinates'][0],
                'lat': geom['coordinates'][1],
                'name': building.get('buildingName', code)
            }

# Build path graph
nodes, nodes_by_id, edges = build_graph(paths_json)

@app.route('/api/buildings', methods=['GET'])
def get_buildings():
    """Return list of all buildings"""
    return jsonify({
        'buildings': [
            {'code': code, 'name': info['name'], 'lat': info['lat'], 'lng': info['lng']}
            for code, info in building_map.items()
        ]
    })


def parse_start_time(time_range: Optional[str]) -> datetime:
    if not time_range:
        return datetime.min
    start_str = time_range.split('-', 1)[0].strip()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(start_str, fmt)
        except ValueError:
            continue
    return datetime.min


def fetch_schedule_for_date(date_obj: date) -> List[Dict]:
    entries = load_schedule_entries()
    weekday = weekday_letter(date_obj)
    matches: List[Dict] = []

    for entry in entries:
        try:
            start_date = datetime.strptime(entry.get('start_date', ''), '%Y-%m-%d').date()
            end_date = datetime.strptime(entry.get('end_date', ''), '%Y-%m-%d').date()
        except (TypeError, ValueError):
            continue

        if weekday not in (entry.get('days') or ''):
            continue

        if start_date <= date_obj <= end_date:
            matches.append(entry)

    matches.sort(key=lambda row: parse_start_time(row.get('time')))

    print(f"[schedule] {date_obj.isoformat()} -> {len(matches)} entries")
    for item in matches:
        print(
            "  -",
            item.get('course_code'),
            item.get('component'),
            item.get('days'),
            item.get('time'),
            item.get('room'),
            f"({item.get('start_date')} to {item.get('end_date')})",
        )

    buildings = [extract_building(entry.get('room')) for entry in matches]
    if len(buildings) > 1:
        print("  Travel sequence:")
        for idx in range(len(buildings) - 1):
            print(f"    {buildings[idx]} -> {buildings[idx + 1]}")
    else:
        print("  Travel sequence: <none>")

    return matches


def build_travel_response(rows: List[Dict]) -> List[Dict]:
    buildings = [extract_building(row.get('room')) for row in rows]
    travel: List[Dict] = []
    for index, current in enumerate(rows):
        previous_building = buildings[index - 1] if index > 0 else None
        travel.append({
            'from': previous_building,
            'to': buildings[index],
            'previousLocation': rows[index - 1]['room'] if index > 0 else None,
            'className': current.get('course_code'),
            'fullName': current.get('course_name'),
            'component': current.get('component'),
            'time': current.get('time'),
            'location': current.get('room'),
        })
    return travel


def handle_schedule_request():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Missing ?date=YYYY-MM-DD'}), 400

    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Date must be YYYY-MM-DD'}), 400

    rows = fetch_schedule_for_date(date_obj)
    return jsonify(build_travel_response(rows))


@app.route('/travel', methods=['GET'])
def legacy_travel():
    return handle_schedule_request()


@app.route('/api/schedule/travel', methods=['GET'])
def schedule_travel():
    return handle_schedule_request()
    
@app.route('/api/schedule/import', methods=['POST'])
def import_schedule_text():
    """Persist pasted Quest schedule text into the on-disk JSON store."""
    payload = request.get_json(silent=True) or {}
    raw_text = payload.get('text', '')
    if not isinstance(raw_text, str) or not raw_text.strip():
        return jsonify({'error': 'Provide schedule text in the "text" field.'}), 400

    try:
        entries = parse_schedule_text(raw_text)
    except Exception as exc:
        return jsonify({'error': f'Unable to parse schedule text: {exc}'}), 400

    if not entries:
        return jsonify({'error': 'No classes found in the supplied text.'}), 400

    try:
        persist_raw_schedule(raw_text)
        save_schedule_entries(entries)
    except Exception as exc:
        return jsonify({'error': f'Unable to persist schedule: {exc}'}), 500

    return jsonify({'imported': len(entries)})

@app.route('/api/path', methods=['POST'])
def find_path():
    """Find shortest path between two buildings"""
    data = request.json
    from_code = data.get('from', '').upper()
    to_code = data.get('to', '').upper()
    
    if not from_code or not to_code:
        return jsonify({'error': 'Missing from or to parameter'}), 400
    
    if from_code not in building_map or to_code not in building_map:
        return jsonify({'error': 'Unknown building code(s)'}), 404
    
    # Find nearest nodes
    from_coord = building_map[from_code]
    to_coord = building_map[to_code]
    
    start_id = nearest_node(nodes_by_id, from_coord['lng'], from_coord['lat'])
    end_id = nearest_node(nodes_by_id, to_coord['lng'], to_coord['lat'])
    
    # Run Dijkstra
    dist, prev = dijkstra(edges, start_id)
    
    if dist[end_id] == float('inf'):
        return jsonify({'error': f'No path found from {from_code} to {to_code}'}), 404
    
    # Reconstruct path
    node_path = reconstruct_path(prev, end_id)
    path_coords = [
        {'lat': nodes_by_id[nid]['lat'], 'lng': nodes_by_id[nid]['lng']}
        for nid in node_path
    ]
    
    return jsonify({
        'from': {'code': from_code, 'name': building_map[from_code]['name']},
        'to': {'code': to_code, 'name': building_map[to_code]['name']},
        'distance': dist[end_id],
        'distance_formatted': format_distance(dist[end_id]),
        'path': path_coords
    })

if __name__ == '__main__':
    print(f"Loaded {len(building_map)} buildings")
    print(f"Built graph with {len(nodes_by_id)} nodes and {sum(len(e) for e in edges.values())//2} edges")
    app.run(debug=True, port=5001)