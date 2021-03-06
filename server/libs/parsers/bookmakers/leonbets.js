const fixTeamName = require("../utils/fixTeamName");
const Logger = require("../utils/logger");
const parseHTML = require("../utils/parseHTML");
const createDOM = require("../utils/createDOM");
const incorrectMatchDate = require("../utils/incorrectMatchDate");
const moment = require("moment");

exports.create = async (URL, leagueName) => {
  const bookmakerName = "Leonbets";
  const logger = new Logger(leagueName, bookmakerName);
  let html;
  const allMatches = [];

  try {
    html = await parseHTML(URL, "dynamic", {
      dataSelector: ".st-group",
      waitSelector: ".stn-val",
      league: leagueName,
      bookmaker: bookmakerName,
    });
    logger.log("got page content");
  }
  catch (e) {
    logger.fail("page content parsing failed", e);
    logger.end();
    return allMatches;
  }

  const $ = createDOM(html);
  logger.log("created virtual dom of page");

  const trs = $(".st-event-body");

  trs.each((i, _element) => {
    try {
      const element = $(_element);
      const match = {};

      // Teams
      {
        const span = element.find(".st-name span");
        const text = span.text().trim();
        const teams = text.split(" - ");
        match.home = fixTeamName(teams[0].trim());
        match.guest = fixTeamName(teams[1].trim());
      }

      // League
      match.league = leagueName;

      // Date
      {
        const date = $(element.find(".st-date")).text();
        const time = $(element.find(".st-time")).text();

        match.date = moment(`${date} ${time}`, "DD MMM HH:mm").valueOf();

        if (incorrectMatchDate(match.date)) return;
      }

      // Coefficients
      {
        match.coefficients = {};
        const as = $(element).find(".stn-val");
        const coefficientTypes = ["1", "0", "2"];

        if (as.length < 3) return;

        as.each((i, a) => {
          const coefficient = parseFloat($(a).text().trim());
          if (!isNaN(coefficient)) {
            match.coefficients[coefficientTypes[i]] = [{
              name: bookmakerName,
              coefficient,
            }];
          }
          else match.coefficients[coefficientTypes[i]] = [];
        });
      }

      allMatches.push(match);
    }
    catch (e) {
      logger.fail("Error while parsing data of match", e, _element);
    }
  });

  if (allMatches.length > 0) logger.log(`[${allMatches.length}] matches created: ${bookmakerName}`);
  else logger.fail(`none matches found: ${bookmakerName}`);

  logger.end();

  return allMatches;
};
