from .errors import JsonHTTPResponse
from .registry import REGISTRY


def serialize(data):
    if isinstance(data, list):
        return [item.to_json() for item in data]
    return data.to_json()


def create_task_not_found_error(task_id):
    return JsonHTTPResponse(
        {"status": 404, "message": f"Task {task_id} not found"},
        status=404,
    )


def validate_scraper_name(scraper_name):
    """Keep this for now as it's used in routes_db_logic"""
    valid_scraper_names = REGISTRY.get_scrapers_names()

    if scraper_name not in valid_scraper_names:
        valid_names_string = ", ".join(valid_scraper_names)
        raise ValueError(
            f"A scraper with the name '{scraper_name}' does not exist. "
            f"Valid scrapers: {valid_names_string}."
        )

    return scraper_name
