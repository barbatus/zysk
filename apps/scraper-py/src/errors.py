from fastapi.responses import JSONResponse


class JsonHTTPResponse(JSONResponse):
    pass


class JsonHTTPResponseWithMessage(JSONResponse):
    def __init__(self, message: str, status: int = 400):
        super().__init__(
            content={"status": status, "message": message},
            status_code=status,
        )
