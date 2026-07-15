// src/utils/ApiResponse.js

class ApiResponse {
    constructor(
        statusCode,
        message,
        data = null
    ) {
        this.success = statusCode < 400;
        this.statusCode = statusCode;
        this.message = message;
        this.data = this.serialize(data);
    }

    serialize(data) {
        if (data === null || data === undefined) {
            return data;
        }

        return JSON.parse(
            JSON.stringify(
                data,
                (_, value) =>
                    typeof value === "bigint"
                        ? value.toString()
                        : value
            )
        );
    }
}

export default ApiResponse;