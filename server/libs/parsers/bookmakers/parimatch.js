const fixTeamName = require("../utils/fixTeamName");
const Logger = require("../utils/logger");
const parseHTML = require("../utils/parseHTML");
const createDOM = require("../utils/createDOM");
const incorrectMatchDate = require("../utils/incorrectMatchDate");

const moment = require("moment");

exports.create = async (URL, leagueName) => {
  const bookmakerName = "Parimatch";
  const logger = new Logger(leagueName, bookmakerName);
  let html;
  const allMatches = [];

  try {
    html = await parseHTML(URL, "static", {
      bookmaker: bookmakerName,
      league: leagueName,
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

  const tBodies = $("tbody[class*='row']");
  tBodies.each((i, _element) => {
    try {
      const element = $(_element);
      if (element.find(".bk").length !== 1) return;

      const match = {};

      // Teams
      {
        const span = element.find("td[class='l']");
        const text = span.html().replace(/\((\w+)\)/g, "");
        const teams = text.split("<br>");
        match.home = fixTeamName(teams[0].trim());
        match.guest = fixTeamName(teams[1].trim());

        if (match.home.includes("Home") && match.guest.includes("Away")) return;
      }

      // League
      match.league = leagueName;

      // Date
      {
        const span = element.find("tr > td:nth-child(2)");
        const text = span.html();
        const [date, time] = text.split("<br>");
        match.date = moment(`${date}/${(new Date()).getFullYear()}-${time}`, "DD/MM/YYYY-HH:mm").valueOf();

        if (incorrectMatchDate(match.date)) return;
      }

      // Coefficients
      {
        match.coefficients = {};

        const coefficientTypes = ["1", "0", "2"];
        coefficientTypes.forEach((cType, index) => {
          const coefficient = +element.find(`tr > td:nth-child(${9 + index})`).text();
          if (!isNaN(coefficient)) {
            match.coefficients[cType] = [{
              name: bookmakerName,
              coefficient,
            }];
          }
          else match.coefficients[coefficientTypes[cType]] = [];
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
