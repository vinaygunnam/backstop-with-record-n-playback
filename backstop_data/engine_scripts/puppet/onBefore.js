module.exports = async (page, scenario, vp, isReference) => {
  await require("./loadCookies")(page, scenario);
  await require("./recordAndPlayback")(page, scenario, isReference);
};
