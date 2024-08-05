const { Command } = require("commander");
const { GearApi, GearKeyring } = require("@gear-js/api");
const fs = require("fs");

const args = process.argv.slice(2);
const program = new Command();

(async () => {
    const gear_api = await GearApi.create({
        providerAddress: "wss://testnet.vara.network"
    });

    program
        .name("config")
        .description("Config an account for deployments")
        .command("set <mnemonic> <name>")
        .action(async (mnemonic, name) => {
            if (!fs.existsSync("./config")) {
                const data = {
                    network_url: "wss://testnet.vara.network",
                    accounts: [
                        {
                            name: name,
                            mnemonic: mnemonic,
                            default: true
                        }
                    ]
                }
                fs.writeFileSync("./config", JSON.stringify(data));
            } else {
                const data = JSON.parse(fs.readFileSync("./config", "utf-8"));
                if (data.accounts.find(acc => acc.name === name)) {
                    console.log("Account with name already exists");
                    return;
                }
                data.accounts.push({
                    name: name,
                    mnemonic: mnemonic,
                    default: false
                });
                fs.writeFileSync("./config", JSON.stringify(data));
            }
        });

    program
        .name("config")
        .description("Change account")
        .command("default <account_name>")
        .action(async (account_name) => {
            const data = JSON.parse(fs.readFileSync("./config", "utf-8"));
            data.accounts.forEach(acc => {
                acc.default = acc.name === account_name;
            });
            fs.writeFileSync("./config", JSON.stringify(data));
        });

    program
        .name("guardian_protocol_gear_cli")
        .description("A simple CLI for CI/CD on GearProtocol")
        .command("deploy <wasm_opt_path> <payload> <meta>")
        .action(async (wasm_opt_path, payload, meta) => {
            const code = fs.readFileSync(wasm_opt_path);
            const payloadData = JSON.parse(fs.readFileSync(payload, "utf-8"));
            const program = {
                code: code,
                gasLimit: 1000000,
                value: 0,
                initPayload: payloadData
            }
            console.log("Creating upload extrinsic");
            const { programId, codeId, salt, extrinsic } = await gear_api.program.upload(program, meta);

            const config = JSON.parse(fs.readFileSync("./config", "utf-8"));
            const account = config.accounts.find(acc => acc.default);
            console.log("Creating signer with: " + account.name)

            const { seed } = GearKeyring.generateSeed(account.mnemonic);
            const signer = await GearKeyring.fromSeed(seed);

            console.log("Signing upload extrinsic");

            await extrinsic.signAndSend(
                signer, ({ status }) => {
                    if (status.isInBlock) {
                        console.log("Extrinsic included at block hash", status.asInBlock.toHex());
                    }
                    if (status.isFinalized) {
                        console.log("Extrinsic finalized at block hash", status.asFinalized.toHex());
                    }
                }
            );

            console.log("Program uploaded with programId:" + programId);
        });

    program.parse(args);
})();