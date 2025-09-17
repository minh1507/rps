package vn.vnpay.rs.berps.controller;


import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController()
@RequestMapping("/v1/file")
public class FileController {
    @PostMapping("/upload")
    public boolean getUsers() {
        return true;
    }
}
