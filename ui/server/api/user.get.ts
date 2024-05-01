export default defineEventHandler((event) => {
	console.log("GET USER ENDPOINT: ", event.context.user);
    if (!event.context.user) {
		throw createError({
			statusCode: 401
		});
	}
	return event.context.user;
});
