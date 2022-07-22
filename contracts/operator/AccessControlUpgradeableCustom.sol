// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract AccessControlUpgradeableCustom is
    Initializable,
    AccessControlUpgradeable
{
    using AddressUpgradeable for address;

    event TransferAdmin(address adminAddress);

    error AdminNotZero();

    function __AccessControlCustom_init() internal onlyInitializing {
        __AccessControl_init();
    }

    function transferAdmin(address newAdmin)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newAdmin == address(0)) {
            revert AdminNotZero();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, _msgSender());
        emit TransferAdmin(newAdmin);
    }
}
