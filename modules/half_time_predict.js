const request = require('request');
const debug = require('debug')('crawler:predict');
const {
    waitAMinute,
    getHtml,
    getDates,
    getDateAndTime,
    getAverage,
    getCookie,
    decodeUtf8
} = require('./../libs/utils');
const {
    calculate
} = require('./calculate');

const fields = ['主胜', '让走水', '客胜', '大', '小', '大小走水'];
const url = 'https://live.dszuqiu.com/ajax/score/data?mt=0';

const parseData = data => data.rs.filter(item => item.f_ld && item.rd).map(item => ({
    game_name: item.league.fn,
    game_last_time: item.status,
    home_team: item.host.sbn,
    half_home_score: parseInt(item.rd.hg, 10),
    half_away_score: parseInt(item.rd.gg, 10),
    away_team: item.guest.sbn,
    game_id: item.id,
    half_handicap_home_odd: parseFloat(item.f_ld.hrfsp, 10),
    half_handicap_goal: parseFloat(item.f_ld.hrf, 10),
    half_handicap_away_odd: parseFloat(item.f_ld.grfsp, 10),
    half_goal_high_odd: parseFloat(item.f_ld.hdxsp, 10),
    half_goal: parseFloat(item.f_ld.hdx, 10),
    half_goal_low_odd: parseFloat(item.f_ld.gdxsp, 10),
}));

const getGames = () => new Promise((resolve, reject) => {
    request(url, (err, data, body) => {
        if (err) reject(err);
        else {
            const parsed_body = JSON.parse(body);
            resolve(parseData(parsed_body));
        }
    });
});

const filterData = (games) => {
    return games.filter(game => (parseInt(game.game_last_time, 10) <= 48 && parseInt(game.game_last_time, 10) >= 43 || game.game_last_time === '半') && (Math.abs(game.half_handicap_goal) >= 0.5));
};

const getBestOdd = (game) => {
    let best_odd_item = {
        field: '',
        odd: 0
    };
    fields.forEach((field) => {
        if (parseInt(game[field], 10) > best_odd_item.odd) {
            best_odd_item.field = field;
            best_odd_item.odd = parseInt(game[field], 10);
        }
    });
    return best_odd_item;
}

const getString = (games) => games.map(game => {
    const game_info = `比赛：${game.game_name}，${game.home_team} VS ${game.away_team}`;
    const half_score = `状态：${game.game_last_time}, 半场比分${game.half_home_score}:${game.half_away_score}`;
	const half_handicap_odd = `主队${game.half_handicap_goal > 0 ? '受让' : '让'} ${Math.abs(game.half_handicap_goal)}, 主胜赔率${game.half_handicap_home_odd}，客胜赔率${game.half_handicap_away_odd}`;
	const half_goals_odd = `大小球${game.half_goal}, 大球赔率${game.half_goal_high_odd}，小球赔率${game.half_goal_low_odd}`;
    const item_str = `标本数量为${game['标本数量']}个`;
    const fields_str = fields.map(field => `${field}概率${game[field]}`).join('，');
    const best_odd = getBestOdd(game);
    const best_odd_str = `最佳投注方式为：${best_odd.field}, 概率为：${best_odd.odd}%`;
    return `${game_info}。 ${half_score}。${half_handicap_odd}。${half_goals_odd}。 ${item_str}。${fields_str}, ${best_odd_str}`;
});

const predictData = async (games) => {
    for (const game of games) {
        const calculated_data = await calculate(game);
        Object.assign(game, calculated_data);
    }
    return getString(games);
}

const start = async () => {
    const games = await getGames();
	// debug(games);
    const filtered_data = filterData(games);
    const predicted_data = await predictData(filtered_data);
	debug(predicted_data);
};

start();
