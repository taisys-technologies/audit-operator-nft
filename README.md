# audit-operator-nft

The contract is based from ERC721, but in order to saving gas fee, we choose to inherit ERC721A.\
Basically, contract is close to original ERC721, but we did some changes to fit requirements,\
the following are some explanation for the function or user scenario.

## Contract Scenario Description
- Period Procedure\
  We want to divide total NFT supply into many rounds of sale, and each round is called as `Period`.\
  We don't record all numbers of supplement for each period in contract, but only the number of current period supply (`_periodTokenSupply`) and the sum of numbers of supplement from the first period to the current period (`_sumOfPeriodTokenSupply`). In this way, we may save some contract storage.\
  While starting next period (function`setPeriodTokenSupply`), admin needs to set up the number of next period maximum NFT supply.\
  Also, if admin wants to start next period, he needs to make sure the NFT supply of previous period are sold out. Otherwise, he can not start next period.\
  Last but not least, `_sumOfPeriodTokenSupply` should not be greater than total NFT supply (`_sumOfLevelTokenSupply`).
</br>

- Users Buy NFT Procedure\
  Only buyers on whitelisting can buy NFT, the detailed method is listed the below function `checkTokenAndMint`.\
  The following will explain about the connection of `_sumOfPeriodTokenSupply` and selling NFT.\
  If the buyer is able to mint NFT, the contract will make sure the `_currentIndex` plus `quantity` which will be the id of the NFT to be minted is not greater than `_sumOfPeriodTokenSupply`.\
  If the above situation is invalid, it means the number of minted NFT is greater than `_sumOfPeriodTokenSupply`. The buyer needs to wait the admin starting the next period. Otherwise, he cannot mint NFT.\
  If the situation is valid, he would be able to mint NFT with token(ERC20).
</br>

## Function Description
- checkTokenAndMint\
  Only address on whitelisting can mint NFT, and this part we implement through EIP712.\
  Every address need to call checkTokenAndMint function with arguments: uuid, userAddress, deadline, uri, and signature.
  The signature will be signed by the address assigned by the contract admin, and that's `ERC721AStorageCustom.layout()._signerAddress`.\
  In addition, we use uuid but not nonce,\
  because if there are two addresses try to request token for mint NFT at the same time,\
  one of the address must fail because they got the same nonce,\
  and the failed executor may be confused about why would the signature be wrong.\
  The signature is provided by `_signerAddress` and should be accurate.\
  In order to optimize user experience, we choose to use uuid though it may cost much more contract storage.
</br>

- setLevel **onlyWorker**\
  To set up price and maxAgentAmount of each level's NFTs.
</br>

- setTokenSupply **onlyWorker**\
  To set up the token supply of specific level, and the new supply must be greater than the old supply.
</br>

- switchMintable **onlyWorker**\
  To switch the specific level's status of mintable.
</br>

- setSignerAddress **onlyWorker**\
  Admin can change the signerAddress who can sign the signature for the raiser who is able to mint NFT.
</br>

- batchMint **onlyAdmin**\
  Admin can batch mint NFT, but it's also needed to be in `Period`.
</br>

- startPeriod **onlyWorker**\
  Worker can start next period, and this function will call `_setPeriodTokenSupply` to set up the token supply of next peiord. Also, Only while the current period is sold out, Worker can start a new period.
</br>

- endPeriod **onlyWorker**\
  Worker can end current period.
</br>

- withdraw **onlyAdmin**\
  When user mint address, the contract will get token.\
  The admin can withdraw the token back or transfer to whoever he want.
</br>

- transferAdmin **onlyAdmin**\
  Admin can transfer his role to another address, but this one only record the transfer information. The another address needs to call `updateAdmin` to complete transfer.
</br>

- updateAdmin\
  If Admin transferred its role to msgSender, msgSender needs to call this function to get the Admin role, and also revoke the old Admin role from old Admin to complete the transfer.
</br>

- cancelTransferAdmin **onlyAdmin**\
  If the Admin regrets about transferring its role, he can delete the transfer information if the transfer hasn't completed.
</br>