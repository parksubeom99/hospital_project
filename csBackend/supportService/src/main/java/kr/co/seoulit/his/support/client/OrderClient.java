package kr.co.seoulit.his.support.client;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderClient {

    private final RestTemplate restTemplate;

    @Value("${order.base-url:http://localhost:8184}")
    private String orderBaseUrl;

    private HttpHeaders forwardHeaders() {
        HttpHeaders headers = new HttpHeaders();
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest req = attrs.getRequest();
                String auth = req.getHeader("Authorization");
                if (auth != null && !auth.isBlank()) {
                    headers.set("Authorization", auth);
                }
                String traceId = req.getHeader("X-Trace-Id");
                if (traceId != null && !traceId.isBlank()) {
                    headers.set("X-Trace-Id", traceId);
                }
            }
        } catch (Exception ignored) {}
        return headers;
    }

    public List<OrderDto> fetchOrders(String status, String category) {
        String url = orderBaseUrl + "/orders?status=" + status + "&category=" + category;
        try {
            HttpEntity<Void> entity = new HttpEntity<>(forwardHeaders());
            ResponseEntity<OrderDto[]> res = restTemplate.exchange(url, HttpMethod.GET, entity, OrderDto[].class);
            OrderDto[] body = res.getBody();
            return body == null ? List.of() : Arrays.asList(body);
        } catch (Exception e) {
            // 조회 실패로 기능 전체가 깨지지 않게 빈 리스트로 degrade
            log.warn("Failed to fetch orders. url={}", url, e);
            return List.of();
        }
    }

    public void markInProgress(Long orderId) {
        String url = orderBaseUrl + "/orders/" + orderId + "/in-progress";
        try {
            HttpEntity<Void> entity = new HttpEntity<>(forwardHeaders());
            restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
        } catch (Exception e) {
            log.warn("Failed to mark order IN_PROGRESS. url={}", url, e);
        }
    }


    public void markResulted(Long orderId) {
        String url = orderBaseUrl + "/orders/" + orderId + "/resulted";
        try {
            HttpEntity<Void> entity = new HttpEntity<>(forwardHeaders());
            restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
        } catch (Exception e) {
            log.warn("Failed to mark order RESULTED. url={}", url, e);
        }
    }

    public void markDone(Long orderId) {
        String url = orderBaseUrl + "/orders/" + orderId + "/done";
        try {
            HttpEntity<Void> entity = new HttpEntity<>(forwardHeaders());
            restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
        } catch (Exception e) {
            log.warn("Failed to mark order DONE. url={}", url, e);
        }
    }
}
