import _ from "lodash";
import Moment from "dayjs";

import * as api from "@/api/bet";

export const state = {
  bets: {
    current: [],
    waiting: [],
    results: [],
  },
  selector: {
    type: "waiting",
    filter: "all",
    sort: "createdAt",
    direction: -1,
  },
  load: {
    status: "wait",
    previous: true,
    permission: true,
  },
};

export const getters = {

  bets (state) {
    return state.bets;
  },

  waitingBets (state) {
    return state.bets.waiting.map(bet => {
      const totalCoefficient = bet.bets.reduce((r, { bookie }) => r * bookie.coefficient, 1);

      return {
        ...bet,
        totalCoefficient,
        totalSum: bet.rate * totalCoefficient,
      };
    });
  },

  filteredResultBets (state) {
    let bets = state.bets.results;
    if (state.selector.filter !== "all") bets = bets.filter(betSlip => betSlip.outcome === state.selector.filter);
    return bets;
  },

  filteredAndSortedResultBets (state, getters) {
    let sortedBets = _.sortBy(getters.filteredResultBets, state.selector.sort);
    if (state.selector.direction === -1) sortedBets = sortedBets.reverse();
    return sortedBets;
  },

  selector (state) {
    return state.selector;
  },

  load (state) {
    return {
      ...state.load,
      ready: state.load.status === "wait" || state.load.status === "loaded",
    };
  },
};

export const mutations = {

  changeCurrentBetSlip (state, { betData, matchData }) {
    const { key, bookie, type } = betData;
    const { home, guest, date, dateTmpl, league } = matchData;
    const selectedBet = state.bets.current.find(bet => bet.key === key);

    if (!selectedBet) {
      state.bets.current.push({ home, guest, date, dateTmpl, league, bookie, key, type });
      return;
    }

    if (selectedBet.type === type) {
      const index = state.bets.current.findIndex(bet => bet.type === type && bet.key === key);
      state.bets.current.splice(index, 1);
    }
  },

  pushToWaiting (state) {
    state.bets.waiting.push({
      rate: 0,
      bets: state.bets.current,
    });
    state.bets.current = [];
  },

  clearResults (state) {
    state.bets.results = [];
  },

  pushToResults (state, data) {
    state.bets.results = data.map(betSlip => {
      const totalCoefficient = betSlip.bets.reduce((r, { bookie }) => r * bookie.coefficient, 1);
      const _betSlip = {
        ...betSlip,
        totalCoefficient,
        totalSum: betSlip.rate * totalCoefficient,
        createdDate: Moment(betSlip.createdAt).format("DD.MM HH:mm"),
      };

      _betSlip.bets.forEach(bet => {
        if (!bet.score || bet.score === "none") {
          bet.matchResult = null;
          return;
        }

        const [home, guest] = bet.score.split(" : ");
        let result;
        if (home > guest) result = "1";
        if (home === guest) result = "0";
        if (home < guest) result = "2";
        bet.matchResult = result;
      });

      const someMatchWaiting = _betSlip.bets.some(bet => bet.matchResult === null);
      const allMatchPredictionCorrect = _betSlip.bets.every(bet => bet.matchResult === bet.type);

      if (someMatchWaiting) _betSlip.outcome = "waiting";
      else if (allMatchPredictionCorrect) _betSlip.outcome = "win";
      else _betSlip.outcome = "lose";

      if (_betSlip.outcome === "waiting") _betSlip.outcomeSum = betSlip.rate * totalCoefficient;
      else if (_betSlip.outcome === "win") _betSlip.outcomeSum = (betSlip.rate * totalCoefficient) - betSlip.rate;
      else _betSlip.outcomeSum = betSlip.rate;

      return _betSlip;
    });
  },

  deleteBet (state, { indexOfBet, indexOfBetSlip }) {
    state.bets.waiting[indexOfBetSlip].bets.splice(indexOfBet, 1);
  },

  deleteBetSlip (state, { index, force }) {
    if (!force && state.bets.waiting[index].bets.length !== 0) return;
    state.bets.waiting.splice(index, 1);
  },

  newRateOfBetSlip (state, { betSlipIndex, rate }) {
    state.bets.waiting[betSlipIndex].rate = rate;
  },

  changeSelector (state, { field, value }) {
    if (field === "filter" && value === "all" && state.selector.sort === "outcomeSum") {
      state.selector.sort = "createdAt";
    }
    state.selector[field] = value;
  },

  resetSelector (state) {
    state.selector.type = "waiting";
    state.selector.filter = "all";
    state.selector.sort = "createdAt";
    state.selector.direction = -1;
  },

  changeLoad (state, { field, value }) {
    state.load[field] = value;
  },

};

export const actions = {

  changeCurrentBetSlip ({ commit, rootState }, betData) {
    commit("changeCurrentBetSlip", {
      betData,
      matchData: rootState.match.matches.find(match => match.key === betData.key),
    });
  },

  pushToWaiting ({ commit }) {
    commit("pushToWaiting");
  },

  async getResults ({ dispatch, getters }, { force, created }) {
    if (!force) {
      if (!getters.load.permission) return;
    }
    if (getters.load.status === "loading") return;

    dispatch("startLoadResults");
    const { data } = await api.getResults(created);
    dispatch("endLoadResults", data);
  },
  startLoadResults ({ commit }) {
    commit("clearResults");
    commit("changeLoad", { field: "status", value: "loading" });
    commit("changeSelector", { field: "filter", value: "all" });
    commit("changeSelector", { field: "sort", value: "createdAt" });
    commit("changeSelector", { field: "direction", value: -1 });
  },
  endLoadResults ({ commit }, results) {
    commit("pushToResults", results);
    commit("changeLoad", { field: "permission", value: false });
    commit("changeLoad", { field: "status", value: "loaded" });
  },

  deleteBet ({ commit }, data) {
    commit("deleteBet", data);
    commit("deleteBetSlip", { index: data.indexOfBetSlip });
  },

  deleteBetSlip ({ commit }, data) {
    commit("deleteBetSlip", data);
  },

  async confirmBetSlip ({ commit, getters }, index) {
    const betSlip = getters.bets.waiting[index];
    const { data, status } = await api.confirmBetSlip(betSlip);
    if (!status) return alert(data);
    commit("deleteBetSlip", { index, force: true });
    commit("changeLoad", { field: "permission", value: false });
  },

  newRateOfBetSlip ({ commit }, newRateData) {
    commit("newRateOfBetSlip", newRateData);
  },

  changeSelector ({ commit }, options) {
    commit("changeSelector", options);
  },

  resetSelector ({ commit }) {
    commit("resetSelector");
  },

  changeLoad ({ commit }, options) {
    commit("changeLoad", options);
  },

};

export const bet = {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
