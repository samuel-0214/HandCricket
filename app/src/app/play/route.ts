import {
  Action,
  ActionError,
  ActionPostRequest,
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
} from "@solana/actions";
import {
  clusterApiUrl,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const headers = createActionHeaders();
const PROGRAM_ID = new PublicKey("7tuKuppYmHV69KKakus2ztV81YrgvWx3vdbhGhxwF8uh");

// Helper function to generate computer's move
const getComputerMove = () => Math.floor(Math.random() * 6) + 1;

// Initialize a Map to store scores for each account
const scoreMap = new Map<string, number>();

export const GET = async () => {
  const payload: Action = {
    icon: "https://i.postimg.cc/52hr198Z/mainblink.png",
    label: "Play Hand Cricket ☝️ ✌️ 🖐️",
    title: "Play Hand Cricket ☝️ ✌️ 🖐️",
    description: "Play the Hand Cricket game",
    links: {
      actions: [
        {
          type: "transaction",
          label: "Play Turn",
          parameters: [
            {
              type: "radio",
              name: "options",
              options: [
                { label: "Play 1", value: "1", selected: false },
                { label: "Play 2", value: "2", selected: false },
                { label: "Play 3", value: "3", selected: false },
                { label: "Play 4", value: "4", selected: false },
                { label: "Play 5", value: "5", selected: false },
                { label: "Play 6", value: "6", selected: false },
              ],
            },
          ],
          href: `/play/`,
        },
      ],
    },
    type: "action",
  };

  return Response.json(payload, { headers });
};

export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest<{ options: string }> & {
      params: ActionPostRequest<{ options: string }>["data"];
    } = await req.json();

    console.log("body:", body);

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch {
      throw 'Invalid "account" provided';
    }

    const accountKey = account.toString();
    const options = (body.params?.options || body.data?.options) as string | undefined;
    
    if (options) {
      const playerMove = parseInt(options);
      const computerMove = getComputerMove();
      const isOut = playerMove === computerMove;
      
      // Get current score or initialize to 0
      let currentScore = scoreMap.get(accountKey) || 0;
      
      // Update score if not out
      if (!isOut) {
        currentScore += playerMove;
        scoreMap.set(accountKey, currentScore);
      }
      
      const connection = new Connection(
        process.env.SOLANA_RPC! || clusterApiUrl("devnet")
      );
      
      const [gameAccount] = PublicKey.findProgramAddressSync(
        [account.toBuffer()],
        PROGRAM_ID
      );

      const transaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        }),
        new TransactionInstruction({
          programId: new PublicKey(PROGRAM_ID),
          data: Buffer.from([116, 200, 44, 67, 23, 228, 209, 99, playerMove]),
          keys: [
            {
              pubkey: gameAccount,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: account,
              isSigner: true,
              isWritable: true,
            },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
        })
      );
      
      transaction.feePayer = account;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: isOut 
            ? `OUT! Computer played ${computerMove}. Game Over! Final Score: ${currentScore} runs 🏏` 
            : `You played ${playerMove}, Computer played ${computerMove}. Current Score: ${currentScore} runs 🏏`,
          type: "transaction",
          links: {
            next: isOut ? {
              type: "inline",
              action: {
                type: "action",
                label: "Game Over",
                icon: "https://i.postimg.cc/52hr198Z/mainblink.png",
                title: "Hand Cricket - Game Over! 🏏",
                description: `Game Over! Final Score: ${currentScore} runs 🎯`,
                links: {
                  actions: [
                    {
                      type: "post",
                      label: "Play Again",
                      href: `/play/`, // Restart game
                    },
                  ] 
                },
              }
            } : {
              type: "inline",
              action: {
                type: "action",
                label: "Play Turn",
                icon: "https://i.postimg.cc/52hr198Z/mainblink.png",
                title: "Play Hand Cricket ☝️ ✌️ 🖐️",
                description: `Current Score: ${currentScore} runs. Play your next turn! 🏏`,
                links: {
                  actions: [
                    {
                      type: "transaction",
                      label: "Play Turn",
                      parameters: [
                        {
                          type: "radio",
                          name: "options",
                          options: [
                            { label: "Play 1", value: "1", selected: false },
                            { label: "Play 2", value: "2", selected: false },
                            { label: "Play 3", value: "3", selected: false },
                            { label: "Play 4", value: "4", selected: false },
                            { label: "Play 5", value: "5", selected: false },
                            { label: "Play 6", value: "6", selected: false },
                          ],
                        },
                      ],
                      href: `/play/`,
                    },
                  ],
                },
              },
            },
          },
        },
      });

      // If player is out, reset their score
      if (isOut) {
        scoreMap.delete(accountKey);
      }

      return Response.json(payload, { headers });
    } else {
      throw 'Invalid "options" provided';
    }
  } catch (error) {
    console.log(error);
    const actionError: ActionError = { message: "An unknown error occurred" };
    if (typeof error == "string") actionError.message = error;
    return Response.json(actionError, {
      status: 400,
      headers,
    });
  }
};

export const OPTIONS = async () => Response.json(null, { headers });