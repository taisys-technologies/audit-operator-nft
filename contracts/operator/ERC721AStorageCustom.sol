// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library ERC721AStorageCustom {
    enum PollStatus {
        Unknown,
        Waiting,
        Success,
        Expired,
        Minted
    }

    struct Poll {
        uint8 level;
        uint16 voter;
        uint256 deadline;
        uint256 period;
    }

    struct Level {
        uint16 voter;
        uint256 price;
    }

    struct Layout {
        // tokens paid from successful mint
        uint256 _availableToken;
        // all periods sum up
        uint256 _availableTokenSupply;
        // token supply of current period
        uint256 _periodTokenSupply;
        // contract max NFT
        uint256 _maxTokenSupply;
        // signer who authorize mint (backend)
        address _signerAddress;
        // paytment token
        address _paymentContract;
        // record used uuid
        mapping(string => bool) _usedUUID;
        // poll info
        mapping(address => Poll) _polls;
        // level of each period
        mapping(uint256 => Level[]) _levels;
        // vote for which poll
        mapping(address => address) _voters;
        // addr who already mint
        mapping(address => bool) _minted;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256("ERC721A.contracts.customStorage.ERC721A");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
