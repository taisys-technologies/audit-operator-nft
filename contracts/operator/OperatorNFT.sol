// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {ERC721AStorageCustom} from "./ERC721AStorageCustom.sol";
import "./AccessControlUpgradeableCustom.sol";
import "./ERC721URIStorageUpgradeable.sol";
import "./PeriodUpgradeable.sol";

contract OperatorNFT is
    ERC721AQueryableUpgradeable,
    ERC721URIStorageUpgradeable,
    EIP712Upgradeable,
    PausableUpgradeable,
    PeriodUpgradeable,
    AccessControlUpgradeableCustom,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ERC721AStorageCustom for ERC721AStorageCustom.Layout;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

    /**
     * Global Variables
     */

    uint256 private constant _DEADLINE_LIMIT = 7;
    bytes32 private constant _CHECKTOKEN_TYPEHASH =
        keccak256(
            "CheckToken(string uuid,address userAddress,uint256 deadline,string uri)"
        );

    /**
     * Events
     */

    event CreatePoll(
        address indexed creater,
        uint8 level,
        uint256 deadline,
        uint256 curPeriod
    );
    event Vote(address indexed voter, address indexed poll);
    event SetMaxTokenSupply(uint256 maxTokenSupply);
    event SetLevel(uint256 period, ERC721AStorageCustom.Level[] levels);
    event SetSignerAddress(address signerAddress);
    event WithdrawByVoter(address indexed voter, uint256 amount);
    event WithdrawByAdmin(address indexed to, uint256 amount);
    event SetPeriodTokenSupply(uint256 periodTokenSupply);
    event StartPeriod(uint256 curPeriod, uint256 periodTokenSupply);
    event EndPeriod(uint256 curPeriod);

    /**
     * Errors
     */

    error MaxTokenSupplyTooLow();
    error InValidSignerAddress();
    error InValidPaymentContract();
    error LevelLengthTooLow();
    error PriceTooLow();
    error VoterTooLow();
    error DeadlineTooLow();
    error NoOwnedNFT();
    error InValidLevel();
    error HasNFTAlready();
    error HasPollAlready();
    error AlreadyVote();
    error NoPoll();
    error InvalidPollStatus();
    error InvalidRole();
    error ExceedAvailableTokenSupply();
    error ContractStarted();
    error NoTokenWithdrawable();
    error ExceedAvailableToken();
    error PeriodTokenSupplyTooLow();
    error PrevPeriodTokenLeft();
    error ExceedMaxTokenSupply();
    error ExpiredDeadline();
    error UsedUUID();
    error InvalidUserAddress();

    /**
     * Initialize
     */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory newName,
        string memory newSymbol,
        uint256 newMaxTokenSupply,
        address newSignerAddress,
        address newPaymentContract,
        ERC721AStorageCustom.Level[] calldata newLevel
    ) public initializerERC721A initializer {
        __ERC721A_init(newName, newSymbol);
        __ERC721AQueryable_init();
        __ERC721URIStorage_init();
        __EIP712_init(newName, "1");
        __Pausable_init();
        __DuringPeriod_init();
        __AccessControlCustom_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        if (newMaxTokenSupply <= 0) {
            revert MaxTokenSupplyTooLow();
        }

        if (newSignerAddress == address(0) || newSignerAddress.isContract()) {
            revert InValidSignerAddress();
        }

        if (
            newPaymentContract == address(0) || !newPaymentContract.isContract()
        ) {
            revert InValidPaymentContract();
        }

        if (newLevel.length < 1) {
            revert LevelLengthTooLow();
        }
        for (uint8 i = 0; i < newLevel.length; i++) {
            if (newLevel[i].price <= 0) {
                revert PriceTooLow();
            }
            if (newLevel[i].voter <= 0) {
                revert VoterTooLow();
            }
            if (newLevel[i].deadline <= 0) {
                revert DeadlineTooLow();
            }
            ERC721AStorageCustom.layout()._levels[currentPeriod()].push(
                newLevel[i]
            );
        }

        ERC721AStorageCustom.layout()._paymentContract = newPaymentContract;
        ERC721AStorageCustom.layout()._maxTokenSupply = newMaxTokenSupply;
        ERC721AStorageCustom.layout()._signerAddress = newSignerAddress;
        // give role to the address who deployed
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * View Functions
     */

    function availableToken() external view returns (uint256) {
        return ERC721AStorageCustom.layout()._availableToken;
    }

    function periodTokenSupply() public view returns (uint256) {
        return ERC721AStorageCustom.layout()._periodTokenSupply;
    }

    function maxTokenSupply() external view returns (uint256) {
        return ERC721AStorageCustom.layout()._maxTokenSupply;
    }

    function signerAddress() external view returns (address) {
        return ERC721AStorageCustom.layout()._signerAddress;
    }

    function paymentContract() external view returns (address) {
        return ERC721AStorageCustom.layout()._paymentContract;
    }

    function poll(address creater)
        external
        view
        returns (ERC721AStorageCustom.PollWithLevel memory)
    {
        ERC721AStorageCustom.Poll memory _poll = ERC721AStorageCustom
            .layout()
            ._polls[creater];
        return
            ERC721AStorageCustom.PollWithLevel({
                level: ERC721AStorageCustom.layout()._levels[_poll.period][
                    _poll.level - 1
                ],
                poll: ERC721AStorageCustom.PollResponse({
                    level: _poll.level,
                    voter: _poll.voter,
                    deadline: _poll.deadline,
                    period: _poll.period,
                    status: pollStatus(creater)
                })
            });
    }

    function level(uint256 period)
        external
        view
        returns (ERC721AStorageCustom.Level[] memory)
    {
        return ERC721AStorageCustom.layout()._levels[period];
    }

    function voter(address user) external view returns (address) {
        return ERC721AStorageCustom.layout()._voters[user];
    }

    function totalMinted() public view returns (uint256) {
        return _totalMinted();
    }

    function periodMinted() public view returns (uint256) {
        return
            totalMinted() -
            (ERC721AStorageCustom.layout()._availableTokenSupply -
                ERC721AStorageCustom.layout()._periodTokenSupply);
    }

    function pollStatus(address pollAddress) public view returns (uint256) {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();

        ERC721AStorageCustom.Poll memory _poll = data._polls[pollAddress];
        if (_poll.level == 0) {
            revert NoPoll();
        }

        ERC721AStorageCustom.Level memory _level = data._levels[_poll.period][
            _poll.level - 1
        ];

        if (data._minted[pollAddress]) {
            return uint256(ERC721AStorageCustom.PollStatus.Minted);
        } else if (_poll.period < currentPeriod() || !duringPeriod()) {
            return uint256(ERC721AStorageCustom.PollStatus.Expired);
        } else if (_poll.voter >= _level.voter) {
            return uint256(ERC721AStorageCustom.PollStatus.Success);
        } else if (_poll.deadline < block.timestamp) {
            return uint256(ERC721AStorageCustom.PollStatus.Expired);
        } else {
            return uint256(ERC721AStorageCustom.PollStatus.Waiting);
        }
    }

    /**
     * Player Functions
     */

    function createPoll(uint8 levelNum)
        external
        whenNotPaused
        whenInPeriod
        nonReentrant
    {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        if (levelNum == 0 || levelNum > data._levels[currentPeriod()].length) {
            revert InValidLevel();
        }
        if (data._minted[_msgSender()]) {
            revert HasNFTAlready();
        }
        if (data._polls[_msgSender()].level != 0) {
            revert HasPollAlready();
        }

        ERC721AStorageCustom.Poll memory newPoll = ERC721AStorageCustom.Poll({
            level: levelNum,
            deadline: block.timestamp +
                data._levels[currentPeriod()][levelNum - 1].deadline *
                1 seconds,
            voter: 0,
            period: currentPeriod()
        });
        data._polls[_msgSender()] = newPoll;
        emit CreatePoll(
            _msgSender(),
            newPoll.level,
            newPoll.deadline,
            newPoll.period
        );
    }

    function checkTokenAndMint(
        string calldata uuid,
        address userAddress,
        uint256 deadline,
        string calldata uri,
        bytes memory signature
    ) external nonReentrant {
        _checkToken(uuid, userAddress, deadline, uri, signature);
        _mint(1, uri);
    }

    function vote(address pollAddr)
        external
        whenNotPaused
        whenInPeriod
        nonReentrant
    {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        ERC721AStorageCustom.Poll memory _poll = data._polls[pollAddr];
        if (data._voters[_msgSender()] != address(0)) {
            revert AlreadyVote();
        }
        if (_poll.level == 0) {
            revert NoPoll();
        }
        if (
            pollStatus(pollAddr) !=
            uint256(ERC721AStorageCustom.PollStatus.Waiting)
        ) {
            revert InvalidPollStatus();
        }

        ERC721AStorageCustom.Level memory _level = data._levels[_poll.period][
            _poll.level - 1
        ];

        data._polls[pollAddr].voter += 1;
        data._voters[_msgSender()] = pollAddr;

        emit Vote(_msgSender(), pollAddr);

        // transfer erc20
        IERC20Upgradeable(data._paymentContract).safeTransferFrom(
            _msgSender(),
            address(this),
            _level.price
        );
    }

    function withdrawByVoter() external nonReentrant {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();

        if (data._voters[_msgSender()] == address(0)) {
            revert NoTokenWithdrawable();
        }
        ERC721AStorageCustom.Poll memory _poll = data._polls[
            data._voters[_msgSender()]
        ];
        ERC721AStorageCustom.Level memory _level = data._levels[_poll.period][
            _poll.level - 1
        ];

        if (
            pollStatus(data._voters[_msgSender()]) !=
            uint256(ERC721AStorageCustom.PollStatus.Expired)
        ) {
            revert InvalidPollStatus();
        }
        data._voters[_msgSender()] = address(0);

        emit WithdrawByVoter(_msgSender(), _level.price);

        // transfer ERC20
        IERC20Upgradeable(data._paymentContract).safeTransfer(
            _msgSender(),
            _level.price
        );
    }

    /**
     * Admin Functions
     */

    function setMaxTokenSupply(uint256 newMaxToken)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        if (data._periodTokenSupply != 0) {
            revert ContractStarted();
        }
        if (newMaxToken <= 0) {
            revert MaxTokenSupplyTooLow();
        }
        data._maxTokenSupply = newMaxToken;
        emit SetMaxTokenSupply(newMaxToken);
    }

    function setLevel(ERC721AStorageCustom.Level[] calldata newLevel)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenNotInPeriod
    {
        if (newLevel.length < 1) {
            revert LevelLengthTooLow();
        }

        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();

        for (uint8 i = 0; i < newLevel.length; i++) {
            if (newLevel[i].price <= 0) {
                revert PriceTooLow();
            }
            if (newLevel[i].voter <= 0) {
                revert VoterTooLow();
            }
            if (newLevel[i].deadline <= 0) {
                revert DeadlineTooLow();
            }
            data._levels[currentPeriod() + 1].push(newLevel[i]);
        }

        emit SetLevel(currentPeriod() + 1, newLevel);
    }

    function setSignerAddress(address newSignerAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newSignerAddress == address(0)) {
            revert InValidSignerAddress();
        }
        ERC721AStorageCustom.layout()._signerAddress = newSignerAddress;
        emit SetSignerAddress(newSignerAddress);
    }

    function withdrawByAdmin(address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        if (amount > data._availableToken) {
            revert ExceedAvailableToken();
        }
        data._availableToken -= amount;
        emit WithdrawByAdmin(to, amount);

        IERC20Upgradeable(data._paymentContract).safeTransfer(to, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function startPeriod(uint256 _periodTokenSupply)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenNotInPeriod
    {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        _setPeriodTokenSupply(_periodTokenSupply);
        uint256 _curPeriod = currentPeriod();
        // If the level of next period didn't be setted, use the previous period setting
        if (data._levels[_curPeriod + 1].length == 0) {
            data._levels[_curPeriod + 1] = data._levels[_curPeriod];
        }

        _startPeriod();
        emit StartPeriod(currentPeriod(), _periodTokenSupply);
    }

    function endPeriod() external onlyRole(DEFAULT_ADMIN_ROLE) whenInPeriod {
        _endPeriod();
        emit EndPeriod(currentPeriod());
    }

    /**
     * Internal Functions
     */

    function _setPeriodTokenSupply(uint256 _periodTokenSupply)
        internal
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        if (_periodTokenSupply <= 0) {
            revert PeriodTokenSupplyTooLow();
        }
        if (periodMinted() != periodTokenSupply()) {
            revert PrevPeriodTokenLeft();
        }

        if (
            data._availableTokenSupply + _periodTokenSupply >
            data._maxTokenSupply
        ) {
            revert ExceedMaxTokenSupply();
        }

        data._periodTokenSupply = _periodTokenSupply;
        data._availableTokenSupply += _periodTokenSupply;
        emit SetPeriodTokenSupply(_periodTokenSupply);
    }

    function _checkToken(
        string calldata uuid,
        address userAddress,
        uint256 deadline,
        string calldata uri,
        bytes memory signature
    ) internal {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        if (block.timestamp > deadline) {
            revert ExpiredDeadline();
        }
        if (data._usedUUID[uuid]) {
            revert UsedUUID();
        }
        if (userAddress != _msgSender()) {
            revert InvalidUserAddress();
        }

        bytes32 structHash = keccak256(
            abi.encode(
                _CHECKTOKEN_TYPEHASH,
                keccak256(bytes(uuid)),
                userAddress,
                deadline,
                keccak256(bytes(uri))
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSAUpgradeable.recover(hash, signature);
        if (signer != data._signerAddress) {
            revert InValidSignerAddress();
        }
        data._usedUUID[uuid] = true;
    }

    function _mint(uint256 quantity, string calldata uri) internal {
        ERC721AStorageCustom.Layout storage data = ERC721AStorageCustom
            .layout();
        uint256 cur = ERC721AStorage.layout()._currentIndex;
        ERC721AStorageCustom.Poll memory _poll = data._polls[_msgSender()];

        if (cur + quantity >= data._availableTokenSupply) {
            revert ExceedAvailableTokenSupply();
        }
        if (data._minted[_msgSender()]) {
            revert HasNFTAlready();
        }

        data._minted[_msgSender()] = true;

        // _safeMint's second argument now takes in a quantity, not a tokenId.
        _safeMint(_msgSender(), quantity);
        for (uint256 i = cur; i < cur + quantity; i++) {
            _setTokenURI(i, uri);
        }

        if (_poll.voter > 0) {
            ERC721AStorageCustom.Level memory _level = data._levels[
                _poll.period
            ][_poll.level - 1];
            data._availableToken += _poll.voter * _level.price;
        }
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override whenNotPaused {
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId)
        internal
        override(ERC721AUpgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721AUpgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721AUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
