import assert from "assert";
import * as anchor from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Program, BN } from "@project-serum/anchor";
import {
    Keypair,
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL,
    Connection,
    Commitment,
} from "@solana/web3.js";
import {
    Orao,
    networkStateAccountAddress,
    randomnessAccountAddress,
    FulfillBuilder,
    InitBuilder,
} from "@orao-network/solana-vrf";
import { RussianRoulette } from "../target/types/russian_roulette";
import nacl from "tweetnacl";

function wait(milliseconds: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

describe("russian-roulette", () => {
    const commitment: Commitment = "confirmed";
    const connection = new Connection("https://api.devnet.solana.com", {
        commitment,
        // wsEndpoint: "wss://api.devnet.solana.com/",
    });
    const options = anchor.AnchorProvider.defaultOptions();
    const wallet = NodeWallet.local();
    const provider = new anchor.AnchorProvider(connection, wallet, options);

    // const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace
        .RussianRoulette as Program<RussianRoulette>;
    const vrf = new Orao(provider);

    // This accounts are for test VRF.
    const treasury = anchor.web3.Keypair.fromSecretKey(
        new Uint8Array([
            49, 136, 26, 82, 163, 73, 47, 85, 231, 35, 41, 16, 72, 100, 148,
            214, 215, 11, 51, 162, 123, 250, 89, 116, 111, 7, 196, 151, 166,
            246, 83, 237, 116, 190, 71, 142, 146, 79, 198, 107, 207, 212, 48,
            15, 128, 52, 25, 205, 46, 113, 230, 127, 153, 127, 23, 96, 192, 119,
            217, 143, 183, 174, 129, 237,
        ])
    );
    const fulfillmentAuthority = anchor.web3.Keypair.fromSecretKey(
        new Uint8Array([
            169, 143, 40, 74, 97, 149, 239, 87, 1, 145, 233, 96, 130, 199, 95,
            78, 90, 67, 66, 3, 82, 243, 74, 180, 215, 244, 118, 201, 194, 217,
            166, 139, 240, 39, 14, 192, 176, 151, 228, 21, 219, 7, 43, 244, 86,
            175, 36, 228, 101, 89, 92, 248, 177, 249, 23, 16, 171, 144, 187,
            141, 114, 254, 147, 78,
        ])
    );

    // Initial force for russian-roulette
    let force = Keypair.generate().publicKey;
    // Player state account address won't change during the tests.
    const [playerState] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("russian-roulette-player-state"),
            provider.wallet.publicKey.toBuffer(),
        ],
        program.programId
    );

    // This helper will play a single round of russian-roulette.
    async function spinAndPullTheTrigger(prevForce: Buffer, force: Buffer) {
        const prevRound = randomnessAccountAddress(prevForce);
        const random = randomnessAccountAddress(force);
        // console.log({
        //     player: provider.wallet.publicKey.toString(),
        //     playerState: playerState.toString(),
        //     prevRound: prevRound.toString(),
        //     vrf: vrf.programId.toString(),
        //     config: networkStateAccountAddress().toString(),
        //     random: random.toString(),
        // });

        await program.methods
            .spinAndPullTheTrigger([...force])
            .accounts({
                player: provider.wallet.publicKey,
                playerState,
                prevRound,
                vrf: vrf.programId,
                config: networkStateAccountAddress(),
                treasury: new PublicKey(
                    "9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR"
                ),
                random,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }

    // This helper will fulfill randomness for our test VRF.
    async function emulateFulfill(seed: Buffer) {
        let signature = nacl.sign.detached(
            seed,
            fulfillmentAuthority.secretKey
        );
        await new FulfillBuilder(vrf, seed).rpc(
            fulfillmentAuthority.publicKey,
            signature
        );
    }

    // before(async () => {
    //     // Initialize test VRF
    //     const fee = 0.02 * LAMPORTS_PER_SOL;
    //     const fulfillmentAuthorities = [fulfillmentAuthority.publicKey];
    //     const configAuthority = anchor.web3.Keypair.fromSecretKey(
    //         new Uint8Array([
    //             84, 168, 66, 66, 234, 51, 160, 197, 190, 42, 3, 143, 35, 140,
    //             196, 137, 69, 27, 126, 37, 220, 68, 16, 241, 107, 197, 85, 72,
    //             28, 56, 115, 166, 140, 153, 5, 171, 147, 252, 59, 132, 113, 232,
    //             42, 12, 10, 120, 180, 79, 189, 35, 176, 126, 44, 190, 61, 140,
    //             208, 101, 6, 81, 198, 167, 36, 164,
    //         ])
    //     );

    //     try {
    //         const result = await new InitBuilder(
    //             vrf,
    //             configAuthority.publicKey,
    //             treasury.publicKey,
    //             fulfillmentAuthorities,
    //             new BN(fee)
    //         ).rpc();
    //         console.log("here1", result);
    //     } catch (err) {
    //         console.log(err);
    //     }
    // });

    it("spin and pull the trigger", async () => {
        await spinAndPullTheTrigger(Buffer.alloc(32), force.toBuffer());

        const playerStateAcc = await program.account.playerState.fetch(
            playerState
        );
        // console.log(Buffer.from(playerStateAcc.force), force.toBuffer());

        assert.ok(Buffer.from(playerStateAcc.force).equals(force.toBuffer()));
        assert.ok(playerStateAcc.rounds.eq(new BN(1)));
    });

    it("play until dead", async () => {
        let currentNumberOfRounds = 1;
        let prevForce = force;

        while (currentNumberOfRounds <= 3) {
            let [randomness] = await Promise.all([
                vrf.waitFulfilled(force.toBuffer()),
                // emulateFulfill(force.toBuffer()),
            ]);

            assert.ok(
                !Buffer.from(randomness.randomness).equals(Buffer.alloc(64))
            );

            console.log(
                "random number",
                Math.floor(
                    Number(
                        Buffer.from(randomness.fulfilled()).readBigUInt64LE()
                    ) / 100000
                ) % 5555
            );
            // if (
            //     Buffer.from(randomness.fulfilled()).readBigUInt64LE() %
            //         BigInt(6) ===
            //     BigInt(0)
            // ) {
            //     console.log("The player is dead");
            //     break;
            // } else {
            //     console.log("The player is alive");
            // }

            // Run another round
            prevForce = force;
            force = Keypair.generate().publicKey;
            await spinAndPullTheTrigger(prevForce.toBuffer(), force.toBuffer());

            const playerStateAcc = await program.account.playerState.fetch(
                playerState
            );

            assert.ok(
                Buffer.from(playerStateAcc.force).equals(force.toBuffer())
            );
            assert.ok(
                playerStateAcc.rounds.eq(new BN(++currentNumberOfRounds))
            );
        }
    });

    it("reset", async () => {
        await program.methods
            .resetState()
            .accounts({
                player: provider.wallet.publicKey,
                playerState,
            })
            .rpc();

        const playerStateAcc = await program.account.playerState.fetch(
            playerState
        );

        // console.log(playerStateAcc);
        assert.ok(playerStateAcc.rounds.eq(new BN(0)));
    });

    // it("generate next random", async () => {
    //     const prevRound = randomnessAccountAddress(
    //         Buffer.from([
    //             23, 192, 22, 169, 71, 195, 174, 237, 62, 158, 63, 143, 199, 57,
    //             124, 42, 236, 88, 79, 84, 221, 30, 185, 128, 223, 240, 65, 178,
    //             85, 136, 102, 4,
    //         ])
    //     );
    //     const random = randomnessAccountAddress(force.toBuffer());
    //     console.log({
    //         player: provider.wallet.publicKey.toString(),
    //         playerState: playerState.toString(),
    //         prevRound: prevRound.toString(),
    //         vrf: vrf.programId.toString(),
    //         config: networkStateAccountAddress().toString(),
    //         random: random.toString(),
    //     });

    //     await program.methods
    //         .spinAndPullTheTrigger([...force.toBuffer()])
    //         .accounts({
    //             player: provider.wallet.publicKey,
    //             playerState,
    //             prevRound,
    //             vrf: vrf.programId,
    //             config: networkStateAccountAddress(),
    //             treasury: new PublicKey(
    //                 "9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR"
    //             ),
    //             random,
    //             systemProgram: SystemProgram.programId,
    //         })
    //         .rpc();

    //     const playerStateAcc = await program.account.playerState.fetch(
    //         playerState
    //     );

    //     // assert.ok(Buffer.from(playerStateAcc.force).equals(force.toBuffer()));
    //     assert.ok(playerStateAcc.rounds.eq(new BN(1)));
    // });

    // it("can't play anymore", async () => {
    //     const prevForce = force;
    //     force = Keypair.generate().publicKey;
    //     try {
    //         await spinAndPullTheTrigger(prevForce.toBuffer(), force.toBuffer());
    //     } catch (e) {
    //         assert.equal(e.error.errorCode.code, "PlayerDead");
    //         return;
    //     }

    //     assert.ok(false, "Instruction invocation should fail");
    // });
});
