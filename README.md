# How to setup 

We should have the following stuff:

- solana-cli 1.16.0 (src:e0fcdbb0; feat:2891131721, client:SolanaLabs)
- rustc 1.70.0 (90c541806 2023-05-31)
- anchor-cli 0.28.0

we should install: (ubuntu 20x)

- Solana's Install Tool
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"

- anchor install 
cargo install --git https://github.com/coral-xyz/anchor --tag v0.28.0 anchor-cli --locked

- rustc 1.70.0 (90c541806 2023-05-31)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

