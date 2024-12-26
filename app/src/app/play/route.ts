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
  
  // create the standard headers for this route (including CORS)
  const headers = createActionHeaders();
  
  const PROGRAM_ID = new PublicKey(
    "BKY8UwwdM4cT5AUzJTL1yPUMcnPMpJy9BLk1g9ACcZMC"
  );
  
  export const GET = async () => {
    const payload: Action = {
      icon: `https://stock.adobe.com/in/images/attractive-editable-vector-cricket-game-in-action-design-great-for-your-design-resources-print-and-others/581304355`,
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
                  {
                    label: "Play 1",
                    value: "1",
                    selected: false,
                  },
                  {
                    label: "Play 2",
                    value: "2",
                    selected: false,
                  },
                  {
                    label: "Play 3",
                    value: "3",
                    selected: false,
                  },
                  {
                    label: "Play 4",
                    value: "4",
                    selected: false,
                  },
                  {
                    label: "Play 5",
                    value: "5",
                    selected: false,
                  },
                  {
                    label: "Play 6",
                    value: "6",
                    selected: false,
                  },
                ],
              },
            ],
            href: `/play/`,
          },
        ],
      },
      type: "action",
    };
  
    return Response.json(payload, {
      headers,
    });
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
      const options = (body.params?.options || body.data?.options) as
        | string
        | undefined;
      if (options) {
        const intOptions = parseInt(options);
        const connection = new Connection(
          process.env.SOLANA_RPC! || clusterApiUrl("devnet")
        );
        const [gameAccount] = PublicKey.findProgramAddressSync(
          [account.toBuffer()],
          PROGRAM_ID
        );
  
        const transaction = new Transaction().add(
          // note: `createPostResponse` requires at least 1 non-memo instruction
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1000,
          }),
          new TransactionInstruction({
            programId: new PublicKey(PROGRAM_ID),
            data: Buffer.from([116, 200, 44, 67, 23, 228, 209, 99, intOptions]),
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
  
        transaction.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;
  
        const payload: ActionPostResponse = await createPostResponse({
          fields: {
            transaction,
            message: `Played with option ${intOptions}`,
            type: "transaction",
            links: {
              /**
               * this `href` will receive a POST request (callback)
               * with the confirmed `signature`
               *
               * you could also use query params to track whatever step you are on
               */
              next: {
                type: "inline",
                action: {
                  type: "action",
                  label: "Play Turn",
                  icon: `https://stock.adobe.com/in/images/attractive-editable-vector-cricket-game-in-action-design-great-for-your-design-resources-print-and-others/581304355`,
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
                              {
                                label: "Play 1",
                                value: "1",
                                selected: false,
                              },
                              {
                                label: "Play 2",
                                value: "2",
                                selected: false,
                              },
                              {
                                label: "Play 3",
                                value: "3",
                                selected: false,
                              },
                              {
                                label: "Play 4",
                                value: "4",
                                selected: false,
                              },
                              {
                                label: "Play 5",
                                value: "5",
                                selected: false,
                              },
                              {
                                label: "Play 6",
                                value: "6",
                                selected: false,
                              },
                            ],
                          },
                        ],
                        href: `/play/`,
                      },
                    ],
                  },
                },
                // href: "/play",
              },
            },
          },
          // no additional signers are required for this transaction
          // signers: [],
        });
  
        return Response.json(payload, {
          headers,
        });
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
  