# How to setup (Ubuntu 20x)

We should have the following stuff:

- solana-cli 1.16.0 (src:e0fcdbb0; feat:2891131721, client:SolanaLabs)
- rustc 1.70.0 (90c541806 2023-05-31)
- anchor-cli 0.28.0

We should install: 

- Solana's Install Tool </br>
```sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"```

- anchor install </br>
```cargo install --git https://github.com/coral-xyz/anchor --tag v0.28.0 anchor-cli --locked```

- rustc 1.70.0 (90c541806 2023-05-31)</br>
```curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh```

## Deploy 

```git clone https://github.com/CryptoElitesClub/solana-vrf && cd solana-vrf/rust/examples/cpi/```</br>
```anchor build``` or ```cargo-build-sbf```</br>
```anchor keys list``` - that will show us an address, that we need to change in the code for 

We should change the result address in some files, such as: 

```programs/russian-roulette/src/lib.rs:declare_id!("2tqa84LLK7E3hUWbQ9AoAUJMjmHEb26je4xjzEeRuBF8");```</br>
```Anchor.toml:russian_roulette = "2tqa84LLK7E3hUWbQ9AoAUJMjmHEb26je4xjzEeRuBF8"```</br>

when is done, we deploy by ```anchor deploy```</br>

```root@vmi724296:~/lottery/lottery_contract/rust/examples/cpi# anchor deploy
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: /root/.config/solana/id.json
Deploying program "russian_roulette"...
Program path: /root/lottery/lottery_contract/rust/examples/cpi/target/deploy/russian_roulette.so...
Program Id: 2tqa84LLK7E3hUWbQ9AoAUJMjmHEb26je4xjzEeRuBF8
```

#### caveat we need change Program Id in the backend!
