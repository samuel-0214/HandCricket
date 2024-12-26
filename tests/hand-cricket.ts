import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { HandCricket } from "../target/types/hand_cricket";
import { assert } from "chai";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("hand-cricket", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.HandCricket as Program<HandCricket>;

  const provider = anchor.getProvider();
  const player = anchor.Wallet.local();
  let gameAccount: anchor.web3.PublicKey;

  // Helper function to fetch game state
  const getGameState = async (gameAccountPublicKey: anchor.web3.PublicKey) => {
    return await program.account.gameAccount.fetch(gameAccountPublicKey);
  };

  // Initialize game account
  before(async () => {
    [gameAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [player.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes game when not active", async () => {
    // Call playTurn with a valid choice
    const playerChoice = 2;

    await program.methods
      .playTurn(playerChoice)
      .accountsStrict({
        gameAccount,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const gameState = await getGameState(gameAccount);
    assert.equal(gameState.isActive, true);
    // Since the contract's choice is random, the score could be 0 or playerChoice
    // We can only check that the player field is set correctly
    assert.equal(gameState.player.toBase58(), player.publicKey.toBase58());
  });

  it("Rejects invalid player choices", async () => {
    const invalidChoices = [0, 7, 255];

    for (const choice of invalidChoices) {
      try {
        await program.methods
          .playTurn(choice)
          .accountsStrict({
            gameAccount,
            player: player.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown an error for invalid choice");
      } catch (err) {
        // Expected error
        assert.equal(err.error.errorCode.code, "InvalidChoice");
      }
    }
  });

  it("Player scores runs when choices don't match", async () => {
    // Assuming the game is active from previous test
    const initialGameState = await getGameState(gameAccount);
    const initialScore = initialGameState.score;

    // We need to ensure that player_choice != contract_choice
    // Since we can't predict contract_choice, we can try multiple times
    let turnPlayed = false;
    let attempts = 0;

    while (!turnPlayed && attempts < 10) {
      attempts++;
      const playerChoice = Math.floor(Math.random() * 6) + 1; // Random choice between 1 and 6

      try {
        await program.methods
          .playTurn(playerChoice)
          .accountsStrict({
            gameAccount,
            player: player.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        const gameState = await getGameState(gameAccount);
        if (gameState.isActive) {
          // Choices didn't match, score should have increased
          assert.equal(gameState.score, initialScore + playerChoice);
          turnPlayed = true;
        } else {
          // Choices matched, game ended, start over
          // Re-initialize the game
          await sleep(1000); // wait for a second before retrying
        }
      } catch (err) {
        console.error("Error playing turn:", err);
        assert.fail("Error playing turn");
      }
    }

    if (!turnPlayed) {
      assert.fail("Couldn't play a turn where choices didn't match");
    }
  });

  it("Game ends when choices match", async () => {
    // Assuming the game is active
    const initialGameState = await getGameState(gameAccount);
    const initialScore = initialGameState.score;

    let gameOver = false;
    let attempts = 0;

    while (!gameOver && attempts < 10) {
      attempts++;
      const playerChoice = Math.floor(Math.random() * 6) + 1; // Random choice between 1 and 6

      try {
        await program.methods
          .playTurn(playerChoice)
          .accountsStrict({
            gameAccount,
            player: player.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        const gameState = await getGameState(gameAccount);
        if (!gameState.isActive) {
          // Game over
          gameOver = true;
          console.log(`Game over with final score: ${gameState.score}`);
          // The score should be as before or increased by player's choice
          // We can't guarantee what it will be due to randomness
        } else {
          // Game is still active, continue
          // Sleep before next attempt
          await sleep(1000);
        }
      } catch (err) {
        console.error("Error playing turn:", err);
        assert.fail("Error playing turn");
      }
    }

    if (!gameOver) {
      assert.fail("Couldn't end the game within 10 attempts");
    }
  });

  it("Score increases appropriately", async () => {
    // Start a new game
    // Ensure game is not active
    let gameState = await getGameState(gameAccount);
    if (gameState.isActive) {
      // End the game by forcing choices to match
      let gameOver = false;
      while (!gameOver) {
        const playerChoice = 1; // Choose a number
        try {
          await program.methods
            .playTurn(playerChoice)
            .accountsStrict({
              gameAccount,
              player: player.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
          gameState = await getGameState(gameAccount);
          if (!gameState.isActive) {
            gameOver = true;
          } else {
            await sleep(1000); // Wait a bit before next attempt
          }
        } catch (err) {
          console.error("Error playing turn:", err);
          assert.fail("Error playing turn");
        }
      }
    }

    // Now start a new game
    const initialScore = 0;
    const playerChoice = 4;

    await program.methods
      .playTurn(playerChoice)
      .accountsStrict({
        gameAccount,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    gameState = await getGameState(gameAccount);
    if (gameState.isActive) {
      // Choices didn't match, score should be increased by player's choice
      assert.equal(gameState.score, initialScore + playerChoice);
    } else {
      // Choices matched, game ended, score should be zero
      assert.equal(gameState.score, initialScore);
    }
  });

  it("Allows multiple plays within the same game", async () => {
    // Ensure game is active
    let gameState = await getGameState(gameAccount);
    if (!gameState.isActive) {
      // Start a new game
      const playerChoice = 3;
      await program.methods
        .playTurn(playerChoice)
        .accountsStrict({
          gameAccount,
          player: player.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      gameState = await getGameState(gameAccount);
    }

    // Play multiple turns
    let gameOver = false;
    let totalScore = gameState.score;

    for (let i = 0; i < 5 && !gameOver; i++) {
      const playerChoice = Math.floor(Math.random() * 6) + 1; // Random choice
      try {
        await program.methods
          .playTurn(playerChoice)
          .accountsStrict({
            gameAccount,
            player: player.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        gameState = await getGameState(gameAccount);
        if (gameState.isActive) {
          totalScore += playerChoice;
          assert.equal(gameState.score, totalScore);
        } else {
          // Game over
          gameOver = true;
          console.log(`Game over with final score: ${gameState.score}`);
        }
        await sleep(1000); // Wait before next turn
      } catch (err) {
        console.error("Error playing turn:", err);
        assert.fail("Error playing turn");
      }
    }
  });
});