import * as fs from 'fs';
import * as base64 from 'base-64';
import psList from 'ps-list';
import axios from 'axios';

class APIGetter {
    private _leagueClient: string;
    private _shell: string[] | null;
    private _lockfile: string | null;
    private _lcuAuthToken: string | null;
    private _region: string | undefined;
    private _authToken: string | undefined;
    private _appPort: string | undefined;
    private _riotClientAuthToken: string | undefined;
    private _riotClientPort: string | undefined;

    constructor() {
        // declare and initialize the necessary fields
        this._leagueClient = 'LeagueClientUx.exe';
        this._shell = null;
        this._lockfile = null;
        this._lcuAuthToken = null;

        // Find the League of Legends process and extract information from the lockfile
        this.findLeagueProcess();
    }

    private async findLeagueProcess(): Promise<void> {
        try {
            const processes = await psList();
            const leagueProcesses = processes.filter(proc => proc.name === this._leagueClient);

            if (leagueProcesses.length > 0) {
                const proc = leagueProcesses[0];
                let str = proc.cmd;
                const repl = { '\\': '/', 'LeagueClientUx.exe': '' };

                for (const [i, j] of Object.entries(repl)) {
                    str = str.replace(i, j);
                }

                this._lockfile = `${str}lockfile`;

                // Lockfile format-> Process Name : Process ID : Port : Password : Protocol
                const fileData = fs.readFileSync(this._lockfile, 'utf8').split(':');
                this._lcuAuthToken = base64.encode(`riot:${fileData[3]}`);
                this._shell = proc.cmd.split(' ');
            } else {
                console.log("League of Legends should be running in order to use this tool.\nQUITTING!\n");
                process.exit();
            }

            // Extract information from the command line arguments
            if (this._shell) {
                this._shell.forEach((line) => {
                    if (line.includes('--region=')) {
                        this._region = line.split('region=')[1].toLowerCase();
                    } else if (line.includes('--remoting-auth-token=')) {
                        this._authToken = line.split('remoting-auth-token=')[1];
                    } else if (line.includes('--app-port=')) {
                        this._appPort = line.split('app-port=')[1];
                    } else if (line.includes('--riotclient-auth-token=')) {
                        const rawToken = line.split('riotclient-auth-token=')[1];
                        this._riotClientAuthToken = base64.encode(`riot:${rawToken}`);
                    } else if (line.includes('--riotclient-app-port=')) {
                        const rawPort = line.split('riotclient-app-port=')[1];
                        this._riotClientPort = `https://127.0.0.1:${rawPort}`;
                    }
                });
            }
        } catch (error) {
            console.error('Error while retrieving process list:', error);
        }
    }

    async getPlayerData(): Promise<string[]> {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'LeagueOfLegendsClient',
            'Authorization': `Basic ${this._riotClientAuthToken}`,
        };

        try {
            const response = await axios.get(`${this._riotClientPort}/chat/v5/participants/champ-select`, { headers, httpsAgent: { rejectUnauthorized: false } });
            const data = response.data;
            console.log(data.participants.map(player => player.name));

            return data.participants.map(player => player.name);
        } catch (error) {
            throw error;
        }
    }

    getMultiLookupOpgg(names: string[]): string {
        const baseUrl = `https://www.op.gg/multisearch/${this._region}?`;
        const params = { summoners: names.join(',') };
        return `${baseUrl}${new URLSearchParams(params).toString()}`;
    }

    getSingleLookupOpgg(name: string): string {
        const baseUrl = 'https://www.op.gg/summoners/';
        const param = `${this._region}/${name}`;
        return `${baseUrl}${param}`;
    }
}

const test = new APIGetter();
test.getSingleLookupOpgg('cleyton icehead');
