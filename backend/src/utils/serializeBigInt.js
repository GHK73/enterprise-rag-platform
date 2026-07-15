const serializeBigInt = (value) => {
    return JSON.parse(
        JSON.stringify(
            value,
            (_, currentValue) =>
                typeof currentValue === "bigint"
                    ? currentValue.toString()
                    : currentValue
        )
    );
};

export default serializeBigInt;