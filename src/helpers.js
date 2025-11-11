function isScheduleEvent() {
  return process.env.APPWRITE_FUNCTION_EVENT === 'schedule';
}

function isHttpEvent() {
  return process.env.APPWRITE_FUNCTION_EVENT === 'http';
}

module.exports = {
  isScheduleEvent,
  isHttpEvent
};
