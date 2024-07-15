import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import axios from "axios";
import dotenv from 'dotenv'
import fs from 'fs'
dotenv.config()

const solanaConnection = new Connection(process.env.RPC_URL!, { wsEndpoint: process.env.WSS_URL! });

enum Filter {
    Receive,
    Send,
    Both
}

const dexscreenapi = 'https://api.dexscreener.com/latest/dex/tokens/'

const getHistory = async (pubkey: PublicKey, mint: PublicKey, filter: Filter) => {
    const history_result: Array<{
        signature: string,
        from: string,
        to: string,
        date: string,
        amount: string,
        symbol: string
        type: string
    }> = []
    const mintData = await solanaConnection.getParsedAccountInfo(mint)
    // @ts-ignore
    const decimals: number = mintData.value?.data.parsed.info.decimals

    const ata = getAssociatedTokenAddressSync(mint, pubkey)

    const history = await solanaConnection.getSignaturesForAddress(ata)

    const symbol = await getSymbol(mint)

    for (let i = 0; i < history.length; i++) {
        if (history[i].err == null) {
            const decoded = await solanaConnection.getParsedTransaction(history[i].signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            })
            if (decoded) {
                const data = await getInfo(decoded, pubkey, ata, solanaConnection, decimals, filter)
                if (data) {
                    history_result.push({ signature: history[i].signature, from: data.from, to: data.to, date: formatDate(history[i].blockTime! * 1000), amount: data.amount, symbol, type: data.type })
                }
            }
        }
    }

    fs.writeFileSync('history.json', JSON.stringify(history_result, null, 4))
}

const getInfo = async (decoded: ParsedTransactionWithMeta, pubkey: PublicKey, ata: PublicKey, solanaConnection: Connection, decimals: number, filter: Filter) => {
    if (decoded?.meta?.logMessages?.toString().includes('TransferChecked')) {
        const inx = decoded.transaction.message?.instructions
        for (const item of inx) {
            // @ts-ignore
            if (item.parsed && item.parsed.type == 'transferChecked') {
                // @ts-ignore
                const { destination, source, tokenAmount } = item.parsed.info
                const amount = tokenAmount.uiAmount
                if (destination.toString() == ata.toString() && (filter == Filter.Receive || filter == Filter.Both)) {
                    const sourceAcc = await solanaConnection.getParsedAccountInfo(new PublicKey(source))
                    // @ts-ignore
                    const owner = sourceAcc.value?.data.parsed.info.owner
                    if (owner) {
                        // type: 'receive'
                        return { type: 'receive', from: owner, to: pubkey.toString(), amount }
                    }
                    else return undefined
                } else if (source.toString() == ata.toString() && (filter == Filter.Send || filter == Filter.Both)) {
                    const destinationAcc = await solanaConnection.getParsedAccountInfo(new PublicKey(destination))
                    // @ts-ignore
                    const owner = destinationAcc.value?.data.parsed.info.owner
                    if (owner) {
                        // type: 'send'
                        return { type: 'send', from: pubkey.toString(), to: owner, amount }
                    }
                    else return undefined
                } else return undefined
            }
        }

    } else if (decoded?.meta?.logMessages?.toString().includes('Transfer')) {
        const inx = decoded.transaction.message?.instructions
        for (const item of inx) {
            // @ts-ignore
            if (item.parsed && item.parsed.type == 'transfer') {
                // @ts-ignore
                const { destination, source, amount } = item.parsed.info
                if (destination.toString() == ata.toString() && (filter == Filter.Receive || filter == Filter.Both)) {
                    const sourceAcc = await solanaConnection.getParsedAccountInfo(new PublicKey(source))
                    // @ts-ignore
                    const owner = sourceAcc.value?.data.parsed.info.owner
                    if (owner) {
                        // type: 'receive'
                        return { type: 'receive', from: owner, to: pubkey.toString(), amount: Number(amount) / Math.pow(10, decimals) }
                    }
                    else return undefined
                } else if (source.toString() == ata.toString() && (filter == Filter.Send || filter == Filter.Both)) {
                    const destinationAcc = await solanaConnection.getParsedAccountInfo(new PublicKey(destination))
                    // @ts-ignore
                    const owner = destinationAcc.value?.data.parsed.info.owner
                    if (owner) {
                        // type: 'send'
                        return { type: 'send', from: pubkey.toString(), to: owner, amount: Number(amount) / Math.pow(10, decimals) }
                    }
                    else return undefined
                } else return undefined
            }
        }
    } else return undefined
}

const getSymbol = async (mint: PublicKey) => {
    const data = await axios.get(`${dexscreenapi}${mint.toString()}`)
    const pair = data.data.pairs[0]
    // console.log(pair)
    if (pair.baseToken.address = mint.toString()) return pair.baseToken.symbol
    if (pair.quoteToken.address = mint.toString()) return pair.quoteToken.symbol
}

function formatDate(timestamp: number): string {
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

const test = async () => {
    const pubkey = new PublicKey('spaxkvvazpDRzDMMPze12HJeg2Q5yY5y7jEtmxN7WXL')
    const mint = new PublicKey('G9tt98aYSznRk7jWsfuz9FnTdokxS6Brohdo9hSmjTRB')
    const mintData = await solanaConnection.getParsedAccountInfo(mint)
    // @ts-ignore
    const decimals: number = mintData.value?.data.parsed.info.decimals
    console.log(decimals)
    const filter = Filter.Both

    const decoded = await solanaConnection.getParsedTransaction('5McnWyfYjcERoucazBKAo7X9pAdu5fhSEUfQWdzPvLEG6d4N18YoJU2PuWEfsY8k2djYosVjpQfytQsY9fRs2nq5', {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
    })
    const ata = getAssociatedTokenAddressSync(mint, pubkey)

    if (decoded) {
        const data = await getInfo(decoded, pubkey, ata, solanaConnection, decimals, filter)
        console.log(data)
    }
}

getHistory(new PublicKey('spaxkvvazpDRzDMMPze12HJeg2Q5yY5y7jEtmxN7WXL'), new PublicKey('G9tt98aYSznRk7jWsfuz9FnTdokxS6Brohdo9hSmjTRB'), Filter.Both)
// test()