"""Small, bounded workspace search. The authenticated workspace is always supplied by the server."""
import asyncio
import re

async def search(db, agency_id, text):
    text = text.strip()
    if len(text) < 2:
        return {'missions': [], 'workers': []}
    pattern = {'$regex': re.escape(text), '$options': 'i'}
    missions, workers = await asyncio.gather(
        db.missions.find({'agency_id': agency_id, '$or': [{'name': pattern}, {'location': pattern}]},
                         {'_id': 0, 'id': 1, 'name': 1, 'location': 1, 'archived': 1}).sort('created_at', -1).limit(6).to_list(6),
        db.workers.find({'agency_id': agency_id, '$or': [{'first_name': pattern}, {'last_name': pattern},
                        {'$expr': {'$regexMatch': {'input': {'$concat': [{'$ifNull': ['$first_name', '']}, ' ', {'$ifNull': ['$last_name', '']}]}, 'regex': re.escape(text), 'options': 'i'}}}]},
                        {'_id': 0, 'id': 1, 'first_name': 1, 'last_name': 1}).sort('last_name', 1).limit(6).to_list(6),
    )
    return {'missions': missions, 'workers': workers}
