# audit-operator-nft

The contract is based from ERC721, but in order to saving gas fee, we choose to inherit ERC721A.\
Basically, contract is close to original ERC721, but we did some changes to fit requirements,\
the following are some explanation for the function and user scenario.

## Contract Scenario Description
- Poll Procedure\
  Everyone who are willing to mint operatorNFT can be Raiser and raise a poll just for once.\
  Raisers need to collect votes, if they get enough votes before a specific time (`_poll.deadline`), they are able to execute `checkTokenAndMint`.\
  Everyone can be a Voter and vote for the Poll they support, but they can only vote for one address, and each vote cost token(ERC20) depends on the Poll's level.\
  If the supported Poll failed, Voter can withdraw token(ERC20) back and vote for the other Poll.\
  If the supported Poll success and Raiser did mint, the token(ERC20) which are paid by Voter will be saved as `_availableToken` which can be withdraw only by admin.
</br>

- Period Procedure\
  We add contract PeriodUpgradeable in order to parting each round of sale, and each round is called as `Period`.\
  While starting next period, admin needs to set up the number of next period maximum NFT supply(`_periodTokenSupply`).\
  The sum of NFT supply of all periods should be not greater than total NFT supply (`_maxTokenSupply`).\
  Also, if admin wants to start next period, he needs to make sure the NFT supply of previous period are sold out. Otherwise, he can not start next period.\
  The reason of setting period is because we want to restrict users can only raise poll, vote when in period (`WhenInPeriod`).
</br>

- Poll Status (**need to meet all following situations**)
  - Waiting
    - Poll is still in period (`_poll.period` equals `_currentPeriod`)
    - Currently is in period (`WhenInPeriod`)
    - Number of Voters hasn't reached the standard
    - Not exceeding the deadline
  - Success
    - Poll is still in period (`_poll.period` equals `_currentPeriod`)
    - Currently is in period (`WhenInPeriod`)
    - Number of Voters reaches the standard
  - Expired 
    - Exceeding the deadline 
      -  `_poll.period` is smaller than `_currentPeriod`
      - `WhenNotInPeriod`
      - `_poll.deadline` is greater than `block.timestamp`).
    - Number of Voters hasn't reached the standard
  - Minted
    - Address who raises the poll has minted NFT
</br>

## Function Description
- createPoll\
  If the address hasn't raised a poll before, he can create a new one in order to get the chance of minting operatorNFT.
</br>

- vote\
  If the address hasn't voted for any poll before, he can vote to any Poll he wants by paying token(ERC20).\
  The number of token depends on `_levels` at the `_poll.period`.
</br>

- checkTokenAndMint\
  Only address on whitelisting can mint NFT, and this part we implement through EIP712.\
  Every address need to call checkTokenAndMint function with arguments: uuid, userAddress, deadline, uri, and signature.\
  The signature will be signed by the address assigned by the contract admin, and that's `ERC721AStorageCustom.layout()._signerAddress`.\
  In addition, we use uuid but not nonce,\
  because if there are two addresses try to request token for mint NFT at the same time,\
  one of the address must fail because they got the same nonce,\
  and the failed executor may be confused about why would the signature be wrong.\
  The signature is provided by `_signerAddress` and should be accurate.\
  In order to optimize user experience, we choose to use uuid though it may cost much more contract storage.\
  Furthermore, who can be on whitelisting basically depends on `_singerAddress`.\
  `_signerAddress` will give Raisers signatures if Raisers' pollStatus are success.\
  Last but not least, if the `_periodTokenSupply` has reached the maximum, even if users get the signature, they still can not mint.
</br>

- withdrawByVoter\
  If the supported Poll fail, Voter can withdraw their token(ERC20) and vote for other Poll.
</br>

- setMaxTokenSupply **onlyAdmin**\
  Offering this function for admin to modify the total NFT supply limit, but only before operatorNFTs haven't start to be sold.
</br>

- setPaymentContract **onlyAdmin**\
  Set up the payment token(ERC20) address for paying for vote.
</br>

- setLevel **onlyAdmin**\
  Set up the level setting for the next period.\
  Each level should be including the following:
    - price: the number of token which voters need to pay for vote at this level
    - vote: the number of voters which raisers need to collect for mint at this level
    - deadline: the poll duration, only during this time can be voted
</br>

- setSignerAddress **onlyAdmin**\
  Admin can change the signerAddress who can sign the signature for the raiser who is able to mint NFT.
</br>

- withdrawByAdmin **onlyAdmin**\
  Admin can withdraw the token(ERC20) which are from polls those are minted.
</br>

- startPeriod **onlyAdmin**\
  Start the next period.\
  At this moment, Admin needs to set up the NFT supply of the next period.
  Also, level will be set up at this moment,\
  and if the next level did't be set before (set up by `setLevel`),\
  we will use the level setting of previous period for next period.
</br>

- _setPeriodTokenSupply **onlyAdmin / internal**\
  Interanal function which will be called by startPeriod.\
  Only can be set up when the NFTs of previous period have been sold out.\
  Also, the sum supply of all periods can not be greater than total NFT supply (`_maxTokenSupply`).
</br>

- endPeriod **onlyAdmin**\
  End the current period.
</br>

- transferAdmin **onlyAdmin**\
  We add this function to achieve grant Admin and transfer at the same time.