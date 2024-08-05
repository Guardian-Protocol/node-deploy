import { Command } from "commander";
import {GearApi, GearKeyring} from "@gear-js/api";
import fs from "fs";

const args = process.argv.slice(2);
const program = new Command();
const gear_api = await GearApi.create({
   providerAddress: "wss://testnet.vara.network"
});

program
    .name("guardian_protocol_gear_cli")
    .description("A simple CLI for CI/CD on GearProtocol")
    .command("deploy <mnemonic> <wasm_opt_path> <payload> <meta>")
    .action(async (mnemonic, wasm_opt_path, payload, meta) => {
        const code = fs.readFileSync(wasm_opt_path);
        const metadata = fs.readFileSync(meta, "utf-8");
        const payloadData = JSON.parse(fs.readFileSync(payload, "utf-8"));
        const program = {
            code: code,
            gasLimit: 1000000,
            value: 0,
            initPayload: payloadData
        }
        console.log("Creating upload extrinsic");
        const { programId, codeId, salt, extrinsic } = await gear_api.program.upload(program, metadata);

        const { seed} = GearKeyring.generateSeed(mnemonic);
        const signer = await GearKeyring.fromSeed(seed);

        console.log("Signing upload extrinsic");

        await extrinsic.signAndSend(
            signer, ({status}) => {
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