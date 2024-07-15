import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import axios from "axios";
import dotenv from 'dotenv'
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
    const ata = getAssociatedTokenAddressSync(mint, pubkey)

    const history = await solanaConnection.getSignaturesForAddress(ata)
    // fs.writeFileSync('history.json', JSON.stringify(history, null, 4))

    const symbol = await getSymbol(mint)

    for (let i = 0; i < history.length; i++) {
        if (history[i].err == null) {
            const decoded = await solanaConnection.getParsedTransaction(history[i].signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            })
            if (decoded) {
                const data = await getInfo(decoded, pubkey, ata, solanaConnection, filter)
                if (data) {
                    history_result.push({ signature: history[i].signature, from: data.from, to: data.to, date: formatDate(history[i].blockTime! * 1000), amount: data.amount, symbol, type: data.type })
                }
            }
        }
    }

    console.log(history_result)
    console.log(history.length)

}

const getInfo = async (decoded: ParsedTransactionWithMeta, pubkey: PublicKey, ata: PublicKey, solanaConnection: Connection, filter: Filter) => {
    if (decoded?.meta?.logMessages?.toString().includes('TransferChecked')) {
        const inx = decoded.transaction.message?.instructions
        for (const item of inx) {
            // @ts-ignore
            if (item.parsed && item.parsed.type == 'transferChecked') {
                // @ts-ignore
                const { destination, source, tokenAmount, mint } = item.parsed.info
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
        return undefined
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

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const month = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');

    return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} +UTC`;
}

getHistory(new PublicKey('2FVMzff3tPBDUE4Jhrc44gZPuueJtExU89y3u6ygwiX6'), new PublicKey('G9tt98aYSznRk7jWsfuz9FnTdokxS6Brohdo9hSmjTRB'), Filter.Both)
// getMetaData(new PublicKey('E6vfvAxPDMegtFiHZAcQLU2UBs2ZcoKAPJSxtpyU2NY1'))