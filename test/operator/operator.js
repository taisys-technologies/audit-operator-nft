const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const getTime = async () => {
  let today = new Date();
  let deadline = Math.floor(today / 1000);

  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return deadline > block.timestamp ? deadline : block.timestamp;
};

describe("OperatorNFT", function () {
  let operator;
  let VegasONE;
  let owner;
  let signer1;
  let signer2;
  let signer3;
  let signer4;
  let signers;
  let levels = [
    { price: ethers.utils.parseEther("1"), voter: 1 },
    { price: ethers.utils.parseEther("2"), voter: 2 },
    { price: ethers.utils.parseEther("3"), voter: 3 },
  ];

  beforeEach(async function () {
    let operatorFactory = await ethers.getContractFactory("OperatorNFT");
    let VegasONEFactory = await ethers.getContractFactory("VegasONE");

    [owner, signer1, signer2, signer3, signer4, ...signers] =
      await ethers.getSigners();

    // deploy VegasONE(ERC20)
    VegasONE = await VegasONEFactory.deploy(
      "VegasONE",
      "VOC",
      ethers.utils.parseEther("10")
    );
    await VegasONE.deployed();

    // deploy operator, signer1 as backend address
    operator = await upgrades.deployProxy(
      operatorFactory,
      ["tn", "ts", 100, signer1.address, VegasONE.address, levels],
      { kind: "uups" }
    );
    await operator.deployed();
    // console.log("Operator deployed to:", operator.address);
  });

  describe("createPoll", function () {
    // signer2 create poll
    it("Positive", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      const tx = await operator.connect(signer2).createPoll(1, deadline);
      await tx.wait();

      // check signer2 poll
      const poll = await operator.poll(signer2.address);
      expect(poll._deadline).to.equal(deadline);
    });

    it("Negative/InValidLevel", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      const tx = operator.connect(signer2).createPoll(5, deadline);
      await expect(tx).to.be.revertedWith("InValidLevel");
    });

    it("Negative/HasPollAlready", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      const tx = await operator.connect(signer2).createPoll(1, deadline);
      await tx.wait();

      const tx2 = operator.connect(signer2).createPoll(1, deadline);
      await expect(tx2).to.be.revertedWith("HasPollAlready");
    });

    it("Negative/InvalidDeadline", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 8 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 8));
      let deadline = Math.floor(newDate / 1000);

      const tx = operator.connect(signer2).createPoll(1, deadline);
      await expect(tx).to.be.revertedWith("InvalidDeadline");
    });
  });

  describe("vote", function () {
    it("Positive", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("1"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      // check signer2 poll
      const poll = await operator.poll(signer2.address);

      expect(poll._voter).to.equal(1);
    });

    it("Negative/AlreadyVote", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("2"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      // signer3 vote again
      let approveAgain = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approveAgain;

      const voteAgain = operator.connect(signer3).vote(signer2.address);
      await expect(voteAgain).to.be.revertedWith("AlreadyVote");
    });

    it("Negative/NoPoll", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // signer3 vote for signer3
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("2"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = operator.connect(signer3).vote(signer3.address);
      await expect(vote).to.be.revertedWith("NoPoll");
    });

    it("Negative/InvalidPollStatus", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("1"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      // generate uuid
      let uuid = "uuid";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: deadline,
        uri: uri,
      };

      // backend signed signature
      const signature = await signer1._signTypedData(domain, types, value);

      // signer2 mint token
      const mint = await operator
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, deadline, uri, signature);
      await mint.wait();

      // signer4 vote for signer2
      await VegasONE.mint(signer4.address, ethers.utils.parseEther("1"));
      let approveAgain = VegasONE.connect(signer4).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approveAgain;

      const voteFaild = operator.connect(signer4).vote(signer2.address);
      await expect(voteFaild).to.be.revertedWith("InvalidPollStatus");
    });
  });

  describe("withdrawByVoter", function async() {
    it("Positive", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: in 1 minute
      let today = new Date();
      let newDate = new Date(today.setMinutes(today.getMinutes() + 1));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(2, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("2"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("2")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      await network.provider.send("evm_increaseTime", [60]);

      const withdrawByVoter = await operator.connect(signer3).withdrawByVoter();
      await withdrawByVoter.wait();

      const signer3Balance = await VegasONE.balanceOf(signer3.address);
      expect(signer3Balance).to.equal(ethers.utils.parseEther("2"));
    });

    it("Negative/NoTokenWithdrawable", async function () {
      const tx = operator.connect(signer3).withdrawByVoter();
      await expect(tx).to.be.revertedWith("NoTokenWithdrawable");
    });

    it("Negative/InvalidPollStatus", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(2, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("2"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("2")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      const tx = operator.connect(signer3).withdrawByVoter();
      await expect(tx).to.be.revertedWith("InvalidPollStatus");
    });
  });

  describe("checkTokenAndMint", function async() {
    it("Positive", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("1"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      // generate uuid
      let uuid = "uuid";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: deadline,
        uri: uri,
      };

      // backend signed signature
      const signature = await signer1._signTypedData(domain, types, value);

      // signer2 mint token
      const mint = await operator
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, deadline, uri, signature);
      await mint.wait();

      // check signer2 has one token
      const ownedId = await operator.tokensOfOwner(signer2.address);
      expect(0).to.equal(ownedId[0]);
    });

    it("Negative/ExpiredDeadline", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("1"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      // generate uuid
      let uuid = "uuid";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      // token expired 1 days ago
      let todayNewDate = new Date();
      let tokenNewDate = new Date(
        todayNewDate.setDate(todayNewDate.getDate() - 1)
      );
      let tokenDeadline = Math.floor(tokenNewDate / 1000);

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: tokenDeadline,
        uri: uri,
      };

      // backend signed signature
      const signature = await signer1._signTypedData(domain, types, value);

      // signer2 mint token
      const mint = operator
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, tokenDeadline, uri, signature);
      await expect(mint).to.be.revertedWith("ExpiredDeadline");
    });

    it("Negative/UsedUUID", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate uuid
      let uuid = "uuid";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      // token expired after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let tokenDeadline = Math.floor(newDate / 1000);

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: tokenDeadline,
        uri: uri,
      };

      // backend signed signature
      const signature = await signer1._signTypedData(domain, types, value);

      // signer2 mint token
      const mint1 = await operator
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, tokenDeadline, uri, signature);

      // signer3 mint token with same uuid
      const mint2 = operator
        .connect(signer3)
        .checkTokenAndMint(uuid, userAddress, tokenDeadline, uri, signature);
      await expect(mint2).to.be.revertedWith("UsedUUID");
    });

    it("Negative/InvalidUserAddress", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate uuid
      let uuid = "uuid";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      // token expired after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let tokenDeadline = Math.floor(newDate / 1000);

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: tokenDeadline,
        uri: uri,
      };

      // backend signed signature
      const signature = await signer1._signTypedData(domain, types, value);

      // signer3 mint token
      const mint = operator
        .connect(signer3)
        .checkTokenAndMint(uuid, userAddress, tokenDeadline, uri, signature);

      await expect(mint).to.be.revertedWith("InvalidUserAddress");
    });

    it("Negative/InValidSignerAddress", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate uuid
      let uuid = "uuid";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      // token expired after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let tokenDeadline = Math.floor(newDate / 1000);

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: tokenDeadline,
        uri: uri,
      };

      // wrong backend(signer2) signed signature
      const signature = await signer2._signTypedData(domain, types, value);

      // signer2 mint token
      const mint = operator
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, tokenDeadline, uri, signature);

      await expect(mint).to.be.revertedWith("InValidSignerAddress");
    });

    it("Negative/ExceedAvailableTokenSupply", async function () {
      // start period
      const startTx = await operator.startPeriod(1);
      await startTx.wait();

      // generate uuid
      let uuid = "uuid";
      let uuid2 = "uuid2";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      // token expired after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let tokenDeadline = Math.floor(newDate / 1000);

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: tokenDeadline,
        uri: uri,
      };

      // backend signed signature for signer2
      const signature = await signer1._signTypedData(domain, types, value);

      // signer2 mint token
      const mint = operator
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, tokenDeadline, uri, signature);

      const secondValue = {
        uuid: uuid2,
        userAddress: signer3.address,
        deadline: tokenDeadline,
        uri: uri,
      };

      // backend signed signature for signer3
      const signature2 = await signer1._signTypedData(
        domain,
        types,
        secondValue
      );

      // signer3 mint token
      const mint2 = operator
        .connect(signer3)
        .checkTokenAndMint(
          uuid2,
          signer3.address,
          tokenDeadline,
          uri,
          signature2
        );

      await expect(mint2).to.be.revertedWith("ExceedAvailableTokenSupply");
    });
  });

  describe("withdrawByAdmin", function async() {
    it("Positive", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("1"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      // generate uuid
      let uuid = "uuid";

      // get userAddress (signer2 as user)
      let userAddress = signer2.address;
      let uri =
        "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

      const domain = {
        name: "tn",
        version: "1",
        chainId: 31337,
        verifyingContract: operator.address,
      };

      const types = {
        CheckToken: [
          { name: "uuid", type: "string" },
          { name: "userAddress", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "uri", type: "string" },
        ],
      };

      const value = {
        uuid: uuid,
        userAddress: userAddress,
        deadline: deadline,
        uri: uri,
      };

      // backend signed signature
      const signature = await signer1._signTypedData(domain, types, value);

      // signer2 mint token
      const mint = await operator
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, deadline, uri, signature);
      await mint.wait();

      const withdrawByAdmin = await operator.withdrawByAdmin(
        owner.address,
        ethers.utils.parseEther("1")
      );
      await withdrawByAdmin.wait();

      const ownerBalance = await VegasONE.balanceOf(owner.address);
      expect(ownerBalance).to.equal(ethers.utils.parseEther("1"));
    });

    it("Negative/ExceedAvailableToken", async function () {
      const withdrawByAdmin = operator.withdrawByAdmin(
        owner.address,
        ethers.utils.parseEther("1")
      );

      await expect(withdrawByAdmin).to.be.revertedWith("ExceedAvailableToken");
    });
  });

  describe("startPeriod", function async() {
    it("Positive", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      const currentPeriod = await operator.currentPeriod();
      expect(currentPeriod).to.equal(1);
    });

    it("Negative/Inperiod", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // start period again
      const startAgain = operator.startPeriod(50);

      await expect(startAgain).to.be.revertedWith("DuringPeiod: during period");
    });

    it("Negative/PeriodTokenSupplyTooLow", async function () {
      // start period
      const startTx = operator.startPeriod(0);
      await expect(startTx).to.be.revertedWith("PeriodTokenSupplyTooLow");
    });

    it("Negative/PrevPeriodTokenLeft", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // end period
      const endTx = await operator.endPeriod();
      await endTx.wait();

      // start period again
      const startAgainTx = operator.startPeriod(50);
      await expect(startAgainTx).to.be.revertedWith("PrevPeriodTokenLeft");
    });

    it("Negative/ExceedMaxTokenSupply", async function () {
      // start period
      const startTx = operator.startPeriod(200);
      await expect(startTx).to.be.revertedWith("ExceedMaxTokenSupply");
    });
  });

  describe("endPeriod", function async() {
    it("Positive", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // end period
      const endTx = await operator.endPeriod();
      await endTx.wait();

      const duringPeriod = await operator.duringPeriod();
      expect(duringPeriod).to.equal(false);
    });

    it("Negative/NotInPeriod", async function () {
      const endTx = operator.endPeriod();
      await expect(endTx).to.be.revertedWith("DuringPeriod: not during period");
    });
  });

  describe("PollStatus", function async() {
    it("Positive/NoPoll", async function () {
      const pollStatus = operator.pollStatus(signer2.address);
      await expect(pollStatus).to.be.revertedWith("NoPoll");
    });

    it("Positive/Waiting", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      const tx = await operator.connect(signer2).createPoll(1, deadline);
      await tx.wait();

      const pollStatus = await operator.pollStatus(signer2.address);
      expect(pollStatus).to.equal(1);
    });

    it("Positive/Success", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("1"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      const pollStatus = await operator.pollStatus(signer2.address);
      expect(2).to.equal(pollStatus);
    });

    it("Positive/Expired/EndPeriod", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: after 7 days
      let today = new Date();
      let newDate = new Date(today.setDate(today.getDate() + 7));
      let deadline = Math.floor(newDate / 1000);

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(1, deadline);
      await createPoll.wait();

      // signer3 vote for signer2
      await VegasONE.mint(signer3.address, ethers.utils.parseEther("1"));
      let approve = VegasONE.connect(signer3).approve(
        operator.address,
        ethers.utils.parseEther("1")
      );
      await approve;

      const vote = await operator.connect(signer3).vote(signer2.address);
      await vote.wait();

      const endTx = await operator.endPeriod();
      await endTx.wait();

      const pollStatus = await operator.pollStatus(signer2.address);
      expect(3).to.equal(pollStatus);
    });

    it("Positive/Expired/Deadline", async function () {
      // start period
      const startTx = await operator.startPeriod(50);
      await startTx.wait();

      // generate deadline: in 1 minute
      let deadline = await getTime();
      deadline += 60;

      // signer2 create poll
      const createPoll = await operator
        .connect(signer2)
        .createPoll(2, deadline);
      await createPoll.wait();

      // make next block.timestamp will be after 1 minute
      await network.provider.send("evm_increaseTime", [60]);
      await network.provider.send("evm_mine");

      const pollStatus = await operator.pollStatus(signer2.address);
      expect(3).to.equal(pollStatus);
    });
  });
});
