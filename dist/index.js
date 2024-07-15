"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const solanaConnection = new web3_js_1.Connection(process.env.RPC_URL, { wsEndpoint: process.env.WSS_URL });
var Filter;
(function (Filter) {
    Filter[Filter["Receive"] = 0] = "Receive";
    Filter[Filter["Send"] = 1] = "Send";
    Filter[Filter["Both"] = 2] = "Both";
})(Filter || (Filter = {}));
const dexscreenapi = 'https://api.dexscreener.com/latest/dex/tokens/';
const getHistory = (pubkey, mint, filter) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const history_result = [];
    const mintData = yield solanaConnection.getParsedAccountInfo(mint);
    // @ts-ignore
    const decimals = (_a = mintData.value) === null || _a === void 0 ? void 0 : _a.data.parsed.info.decimals;
    const ata = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, pubkey);
    const history = yield solanaConnection.getSignaturesForAddress(ata);
    const symbol = yield getSymbol(mint);
    for (let i = 0; i < history.length; i++) {
        if (history[i].err == null) {
            const decoded = yield solanaConnection.getParsedTransaction(history[i].signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });
            if (decoded) {
                const data = yield getInfo(decoded, pubkey, ata, solanaConnection, decimals, filter);
                if (data) {
                    history_result.push({ signature: history[i].signature, from: data.from, to: data.to, date: formatDate(history[i].blockTime * 1000), amount: data.amount, symbol, type: data.type });
                }
            }
        }
    }
    fs_1.default.writeFileSync('history.json', JSON.stringify(history_result, null, 4));
});
const getInfo = (decoded, pubkey, ata, solanaConnection, decimals, filter) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if ((_b = (_a = decoded === null || decoded === void 0 ? void 0 : decoded.meta) === null || _a === void 0 ? void 0 : _a.logMessages) === null || _b === void 0 ? void 0 : _b.toString().includes('TransferChecked')) {
        const inx = (_c = decoded.transaction.message) === null || _c === void 0 ? void 0 : _c.instructions;
        for (const item of inx) {
            // @ts-ignore
            if (item.parsed && item.parsed.type == 'transferChecked') {
                // @ts-ignore
                const { destination, source, tokenAmount } = item.parsed.info;
                const amount = tokenAmount.uiAmount;
                if (destination.toString() == ata.toString() && (filter == Filter.Receive || filter == Filter.Both)) {
                    const sourceAcc = yield solanaConnection.getParsedAccountInfo(new web3_js_1.PublicKey(source));
                    // @ts-ignore
                    const owner = (_d = sourceAcc.value) === null || _d === void 0 ? void 0 : _d.data.parsed.info.owner;
                    if (owner) {
                        // type: 'receive'
                        return { type: 'receive', from: owner, to: pubkey.toString(), amount };
                    }
                    else
                        return undefined;
                }
                else if (source.toString() == ata.toString() && (filter == Filter.Send || filter == Filter.Both)) {
                    const destinationAcc = yield solanaConnection.getParsedAccountInfo(new web3_js_1.PublicKey(destination));
                    // @ts-ignore
                    const owner = (_e = destinationAcc.value) === null || _e === void 0 ? void 0 : _e.data.parsed.info.owner;
                    if (owner) {
                        // type: 'send'
                        return { type: 'send', from: pubkey.toString(), to: owner, amount };
                    }
                    else
                        return undefined;
                }
                else
                    return undefined;
            }
        }
    }
    else if ((_g = (_f = decoded === null || decoded === void 0 ? void 0 : decoded.meta) === null || _f === void 0 ? void 0 : _f.logMessages) === null || _g === void 0 ? void 0 : _g.toString().includes('Transfer')) {
        const inx = (_h = decoded.transaction.message) === null || _h === void 0 ? void 0 : _h.instructions;
        for (const item of inx) {
            // @ts-ignore
            if (item.parsed && item.parsed.type == 'transfer') {
                // @ts-ignore
                const { destination, source, amount } = item.parsed.info;
                if (destination.toString() == ata.toString() && (filter == Filter.Receive || filter == Filter.Both)) {
                    const sourceAcc = yield solanaConnection.getParsedAccountInfo(new web3_js_1.PublicKey(source));
                    // @ts-ignore
                    const owner = (_j = sourceAcc.value) === null || _j === void 0 ? void 0 : _j.data.parsed.info.owner;
                    if (owner) {
                        // type: 'receive'
                        return { type: 'receive', from: owner, to: pubkey.toString(), amount: Number(amount) / Math.pow(10, decimals) };
                    }
                    else
                        return undefined;
                }
                else if (source.toString() == ata.toString() && (filter == Filter.Send || filter == Filter.Both)) {
                    const destinationAcc = yield solanaConnection.getParsedAccountInfo(new web3_js_1.PublicKey(destination));
                    // @ts-ignore
                    const owner = (_k = destinationAcc.value) === null || _k === void 0 ? void 0 : _k.data.parsed.info.owner;
                    if (owner) {
                        // type: 'send'
                        return { type: 'send', from: pubkey.toString(), to: owner, amount: Number(amount) / Math.pow(10, decimals) };
                    }
                    else
                        return undefined;
                }
                else
                    return undefined;
            }
        }
    }
    else
        return undefined;
});
const getSymbol = (mint) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield axios_1.default.get(`${dexscreenapi}${mint.toString()}`);
    const pair = data.data.pairs[0];
    // console.log(pair)
    if (pair.baseToken.address = mint.toString())
        return pair.baseToken.symbol;
    if (pair.quoteToken.address = mint.toString())
        return pair.quoteToken.symbol;
});
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} +UTC`;
}
getHistory(new web3_js_1.PublicKey('spaxkvvazpDRzDMMPze12HJeg2Q5yY5y7jEtmxN7WXL'), new web3_js_1.PublicKey('G9tt98aYSznRk7jWsfuz9FnTdokxS6Brohdo9hSmjTRB'), Filter.Both);
