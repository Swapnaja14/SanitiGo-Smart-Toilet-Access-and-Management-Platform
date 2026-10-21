const validateQuery = (schema) => (req, res, next) => {
    try {
        const validated = schema.parse(req.query);
        req.validatedQuery = validated;
        next();
    } catch (error) {
        next(error);
    }
};

export default validateQuery;
