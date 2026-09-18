package com.wetalk.auth.jwt;

import com.wetalk.auth.config.SecurityJwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.Optional;

/**
 * JWT 签发与校验（HS256）
 * claim typ: access | refresh
 */
@Service
public class JwtTokenService {

    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private static final String CLAIM_USERNAME = "username";
    private static final String CLAIM_TYPE = "typ";

    private final SecretKey key;
    private final SecurityJwtProperties props;

    public JwtTokenService(SecurityJwtProperties props) {
        this.props = props;
        this.key = Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String issueAccess(Long userId, String username) {
        return issue(userId, username, TYPE_ACCESS,
                Duration.ofMinutes(props.getAccessExpireMinutes()));
    }

    public String issueRefresh(Long userId, String username) {
        return issue(userId, username, TYPE_REFRESH,
                Duration.ofDays(props.getRefreshExpireDays()));
    }

    /**
     * 解析并校验签名，失败返回 empty（过期/篡改/格式错误一律拒绝）。
     */
    public Optional<Claims> parse(String token) {
        try {
            return Optional.of(Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public Optional<LoginUser> parseAccess(String token) {
        return parse(token)
                .filter(c -> TYPE_ACCESS.equals(c.get(CLAIM_TYPE, String.class)))
                .map(c -> new LoginUser(Long.valueOf(c.getSubject()), c.get(CLAIM_USERNAME, String.class)));
    }

    public Optional<LoginUser> parseRefresh(String token) {
        return parse(token)
                .filter(c -> TYPE_REFRESH.equals(c.get(CLAIM_TYPE, String.class)))
                .map(c -> new LoginUser(Long.valueOf(c.getSubject()), c.get(CLAIM_USERNAME, String.class)));
    }

    public long accessExpireSeconds() {
        return Duration.ofMinutes(props.getAccessExpireMinutes()).toSeconds();
    }

    private String issue(Long userId, String username, String type, Duration ttl) {
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim(CLAIM_USERNAME, username)
                .claim(CLAIM_TYPE, type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttl.toMillis()))
                .signWith(key)
                .compact();
    }
}
