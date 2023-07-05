const express = require("express");
const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");
const dotenv = require("dotenv");
dotenv.config();
const app = express();

// Define your OAuth 1.0 credentials
const oauth = OAuth({
  consumer: {
    key: process.env.TWITTER_COSUMER_KEY,
    secret: process.env.TWITTER_COSUMER_SECRET,
  },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

// Define the access token and token secret
const accessToken = process.env.TWITTER_ACCESS_TOKEN;
const tokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

const getUserbyName = async (userName) => {
  // #swagger.tags = ['Social Tasks']
  try {
    const endpoint = `https://api.twitter.com/2/users/by/username/${userName}`;

    const requestData = {
      url: endpoint,
      method: "GET",
    };

    const authHeaders = oauth.toHeader(
      oauth.authorize(requestData, {
        key: accessToken,
        secret: tokenSecret,
      })
    );

    const { data } = await axios.get(endpoint, {
      headers: {
        ...authHeaders,
      },
    });

    if (data.data) {
      return data.data;
    }
  } catch (error) {
    console.log(error.message);
  }

  return { id: 0 };
};

// Define a route to retrieve a twitter post's retweets
app.get("/retweets/:userName/:postId", async (req, res) => {
  try {
    const { userName, postId } = req.params;
    const userInfo = await getUserbyName(userName);

    if (userInfo.id === 0) {
      return res.status(400).json({
        msg: "User name is invalid.",
      });
    }

    const endpoint = `https://api.twitter.com/2/tweets/${postId}/retweeted_by`;

    let paginationToken = "";
    do {
      const queryParams = {
        max_results: 100,
      };

      if (paginationToken.length) {
        queryParams.pagination_token = paginationToken;
      }

      const requestData = {
        url: endpoint,
        method: "GET",
        data: queryParams,
      };

      const authHeaders = oauth.toHeader(
        oauth.authorize(requestData, {
          key: accessToken,
          secret: tokenSecret,
        })
      );

      const { data } = await axios.get(endpoint, {
        headers: {
          ...authHeaders,
        },
        params: queryParams,
      });

      if (!data.data) break;

      const retweetUsers = data.data.map((user) => ({
        id: user.id,
      }));

      const isRetweeted = retweetUsers.find((user) => user.id == userInfo.id);

      if (isRetweeted) {
        return res.status(200).json({
          msg: "User retweeted the post.",
          hasRetweeted: true,
        });
      }

      const nextPaginationToken = data.meta?.next_token ?? "";
      paginationToken =
        nextPaginationToken && paginationToken !== nextPaginationToken
          ? nextPaginationToken
          : "";
    } while (paginationToken.length > 0);

    return res.status(200).json({
      msg: "User has not retweeted the post.",
      hasRetweeted: false,
    });
  } catch (error) {
    return res.status(500).json({
      msg: "Internal server error at Checking Social-Tasks Retweeted Status",
      error: error.message,
    });
  }
});

// Define a route to retrieve a user's followers
app.get("/followers/:userName", async (req, res) => {
  const { userName } = req.params;
  const userInfo = await getUserbyName(userName);

  if (userInfo.id === 0) {
    return res.status(400).json({
      msg: "User name is invalid.",
    });
  }

  const apiUrl = `https://api.twitter.com/2/users/${userInfo.id}/followers`;

  const requestData = {
    url: apiUrl,
    method: "GET", // Replace with the desired HTTP method (GET, POST, etc.)
  };

  const authHeaders = oauth.toHeader(
    oauth.authorize(requestData, {
      key: accessToken,
      secret: tokenSecret,
    })
  );

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        ...authHeaders,
      },
    });

    // Extract the follower details from the API response
    const followers = response.data.data.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
    }));

    res.json({ count: followers.length, data: followers });
  } catch (error) {
    // Handle errors
    console.error("Error retrieving followers:", error);
    res.status(500).json({ error: error });
  }
});

// Define a route to retrieve a user's followers
app.get("/followings/:userName", async (req, res) => {
  const { userName } = req.params;
  const userInfo = await getUserbyName(userName);

  if (userInfo.id === 0) {
    return res.status(400).json({
      msg: "User name is invalid.",
    });
  }
  const apiUrl = `https://api.twitter.com/2/users/${userInfo.id}/following`;

  try {
    let allFollowings = [];
    let paginationToken = "";

    do {
      const queryParams = {
        max_results: 100,
      };

      if (paginationToken.length) {
        queryParams.pagination_token = paginationToken;
      }

      const requestData = {
        url: apiUrl,
        method: "GET", // Replace with the desired HTTP method (GET, POST, etc.)
        data: queryParams,
      };

      const authHeaders = oauth.toHeader(
        oauth.authorize(requestData, {
          key: accessToken,
          secret: tokenSecret,
        })
      );

      const response = await axios.get(apiUrl, {
        headers: {
          ...authHeaders,
        },
        params: queryParams,
      });
      // Extract the follower details from the API response
      if (!response.data.data) break;

      const followers = response.data.data.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
      }));
      allFollowings = allFollowings.concat(followers);

      if (response.data.meta && response.data.meta.next_token) {
        if (paginationToken == response.data.meta.next_token)
          paginationToken = "";
        else paginationToken = response.data.meta.next_token;
      } else {
        paginationToken = "";
      }
    } while (paginationToken.length > 0);

    res.json({ count: allFollowings.length, data: allFollowings });
  } catch (error) {
    // Handle errors
    console.error("Error retrieving followers:", error);
    res.status(500).json({ error: error });
  }
});

// Start the server
app.listen(8080, () => {
  console.log("Server is running on http://localhost:8080");
});
