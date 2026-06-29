const notFound = (req,res,next)=>{
    const error = new Error(`Route Not Found - ${req.originalUrl}`);
    error.statusCode = 404;

    next(error);
};

export default notFound;