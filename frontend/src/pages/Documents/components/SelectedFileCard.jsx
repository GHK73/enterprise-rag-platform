const SelectedFileCard = ({
    file,
    onRemove,
}) => {
    if (!file) {
        return null;
    }

    return (
        <div className="selected-file">

            <h3>Selected File</h3>

            <p>
                <strong>Name:</strong>{" "}
                {file.name}
            </p>

            <p>
                <strong>Type:</strong>{" "}
                {file.type}
            </p>

            <p>
                <strong>Size:</strong>{" "}
                {(file.size / 1024 / 1024).toFixed(2)}
                {" "}
                MB
            </p>

            <p>
                <strong>Last Modified:</strong>{" "}
                {new Date(
                    file.lastModified
                ).toLocaleString()}
            </p>

            <button
                type="button"
                className="secondary-button"
                onClick={onRemove}
            >
                Remove File
            </button>

        </div>
    );
};

export default SelectedFileCard;