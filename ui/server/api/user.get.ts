export default defineEventHandler((event) => {
	console.log("USER CONETNT: ", event.context)
	return event.context.user;
});
